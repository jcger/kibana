/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { isNumber, keys, values, find, each, flatten } from 'lodash';
import { i18n } from '@kbn/i18n';
import type { estypes } from '@elastic/elasticsearch';
import {
  buildExistsFilter,
  buildPhrasesFilter,
  buildQueryFromFilters,
  Filter,
} from '@kbn/es-query';
import { lastValueFrom } from 'rxjs';
import { AggGroupNames } from '../agg_groups';
import { IAggConfigs } from '../agg_configs';
import { IAggType } from '../agg_type';
import { IAggConfig } from '../agg_config';
import { createSamplerAgg } from '../utils/sampler';

const MISSING_KEY_STRING = '__missing__';
export const OTHER_NESTED_BUCKET_SEPARATOR = '╰┄►';
const otherBucketRegexp = new RegExp(`^${OTHER_NESTED_BUCKET_SEPARATOR}`);

/**
 * walks the aggregation DSL and returns DSL starting at aggregation with id of startFromAggId
 * @param aggNestedDsl: aggregation config DSL (top level)
 * @param startFromId: id of an aggregation from where we want to get the nested DSL
 */
const getNestedAggDSL = (aggNestedDsl: Record<string, any>, startFromAggId: string): any => {
  if (aggNestedDsl[startFromAggId]) {
    return aggNestedDsl[startFromAggId];
  }
  const nestedAggs: Array<Record<string, any>> = values(aggNestedDsl);
  let aggs;

  for (let i = 0; i < nestedAggs.length; i++) {
    if (nestedAggs[i].aggs && (aggs = getNestedAggDSL(nestedAggs[i].aggs, startFromAggId))) {
      return aggs;
    }
  }
};

/**
 * returns buckets from response for a specific other bucket
 * @param aggConfigs: configuration for the aggregations
 * @param response: response from elasticsearch
 * @param aggWithOtherBucket: AggConfig of the aggregation with other bucket enabled
 * @param key: key from the other bucket request for a specific other bucket
 */
const getAggResultBuckets = (
  aggConfigs: IAggConfigs,
  response: estypes.SearchResponse<any>['aggregations'],
  aggWithOtherBucket: IAggConfig,
  key: string
) => {
  const keyParts = key.split(OTHER_NESTED_BUCKET_SEPARATOR);
  let responseAgg = response;
  for (const i in keyParts) {
    // enable also the empty string
    if (keyParts[i] != null) {
      const responseAggs: Array<Record<string, any>> = values(responseAgg);
      // If you have multi aggs, we cannot just assume the first one is the `other` bucket,
      // so we need to loop over each agg until we find it.
      for (let aggId = 0; aggId < responseAggs.length; aggId++) {
        const aggById = responseAggs[aggId];
        const aggKey = keys(responseAgg)[aggId];
        const aggConfig = find(aggConfigs.aggs, (agg) => agg.id === aggKey);
        if (aggConfig) {
          const aggResultBucket = find(aggById.buckets, (bucket, bucketObjKey) => {
            const bucketKey = aggConfig
              .getKey(bucket, isNumber(bucketObjKey) ? undefined : bucketObjKey)
              .toString();
            return bucketKey === keyParts[i];
          });
          if (aggResultBucket) {
            // this is a special check in order to avoid an overwrite when
            // there's an empty string term at root level for the data request
            // as the other request will default to empty string category as well
            if (!responseAgg?.[aggWithOtherBucket.id] || keyParts[i] !== '') {
              responseAgg = aggResultBucket;
              break;
            }
          }
        }
      }
    }
  }
  if (responseAgg?.[aggWithOtherBucket.id]) {
    return (responseAgg[aggWithOtherBucket.id] as any).buckets;
  }
  return [];
};

/**
 * gets all the missing buckets in our response for a specific aggregation id
 * @param responseAggs: array of aggregations from response
 * @param aggId: id of the aggregation with missing bucket
 */
const getAggConfigResultMissingBuckets = (responseAggs: any, aggId: string) => {
  const resultBuckets: Array<Record<string, any>> = [];
  if (responseAggs[aggId]) {
    const matchingBucket = responseAggs[aggId].buckets.find(
      (bucket: Record<string, any>) => bucket.key === MISSING_KEY_STRING
    );
    if (matchingBucket) {
      resultBuckets.push(matchingBucket);
    }
    return resultBuckets;
  }
  each(responseAggs, (agg) => {
    if (agg.buckets) {
      each(agg.buckets, (bucket) => {
        resultBuckets.push(...getAggConfigResultMissingBuckets(bucket, aggId));
      });
    }
  });

  return resultBuckets;
};

/**
 * gets all the terms that are NOT in the other bucket
 * @param requestAgg: an aggregation we are looking at
 * @param key: the key for this specific other bucket
 * @param otherAgg: AggConfig of the aggregation with other bucket
 */
const getOtherAggTerms = (requestAgg: Record<string, any>, key: string, otherAgg: IAggConfig) => {
  return requestAgg['other-filter'].filters.filters[key].bool.must_not
    .filter(
      (filter: Record<string, any>) =>
        filter.match_phrase && filter.match_phrase[otherAgg.params.field.name] != null // mind empty strings!
    )
    .map((filter: Record<string, any>) => filter.match_phrase[otherAgg.params.field.name]);
};

/**
 * Helper function to handle sampling case and get the correct cursor agg from a request object
 */
const getCorrectAggCursorFromRequest = (
  requestAgg: Record<string, any>,
  aggConfigs: IAggConfigs
) => {
  return aggConfigs.isSamplingEnabled() ? requestAgg.sampling.aggs : requestAgg;
};

/**
 * Helper function to handle sampling case and get the correct cursor agg from a response object
 */
const getCorrectAggregationsCursorFromResponse = (
  response: estypes.SearchResponse<any>,
  aggConfigs: IAggConfigs
) => {
  return aggConfigs.isSamplingEnabled()
    ? (response.aggregations?.sampling as Record<string, estypes.AggregationsAggregate>)
    : response.aggregations;
};

export const buildOtherBucketAgg = (
  aggConfigs: IAggConfigs,
  aggWithOtherBucket: IAggConfig,
  response: any
) => {
  const bucketAggs = aggConfigs.aggs.filter(
    (agg) => agg.type.type === AggGroupNames.Buckets && agg.enabled
  );
  const index = bucketAggs.findIndex((agg) => agg.id === aggWithOtherBucket.id);
  const aggs = aggConfigs.toDsl();
  const indexPattern = aggWithOtherBucket.aggConfigs.indexPattern;

  // create filters aggregation
  const filterAgg = aggConfigs.createAggConfig(
    {
      type: 'filters',
      id: 'other',
      params: {
        filters: [],
      },
      enabled: false,
    },
    {
      addToAggConfigs: false,
    }
  );

  // nest all the child aggregations of aggWithOtherBucket
  const resultAgg = {
    aggs: getNestedAggDSL(aggs, aggWithOtherBucket.id).aggs,
    filters: filterAgg.toDsl(),
  };

  let noAggBucketResults = false;
  let exhaustiveBuckets = true;

  // recursively create filters for all parent aggregation buckets
  const walkBucketTree = (
    aggIndex: number,
    aggregations: any,
    aggId: string,
    filters: any[],
    key: string
  ) => {
    // make sure there are actually results for the buckets
    const agg = aggregations[aggId];
    if (
      !agg ||
      // buckets can be either an array or an object in case there's also a filter at the same level
      (Array.isArray(agg.buckets) ? !agg.buckets.length : !Object.values(agg.buckets).length)
    ) {
      noAggBucketResults = true;
      return;
    }
    const newAggIndex = aggIndex + 1;
    const newAgg = bucketAggs[newAggIndex];
    const currentAgg = bucketAggs[aggIndex];
    if (aggIndex === index && agg && agg.sum_other_doc_count > 0) {
      exhaustiveBuckets = false;
    }
    if (aggIndex < index) {
      each(agg?.buckets, (bucket: any, bucketObjKey) => {
        const bucketKey = currentAgg.getKey(
          bucket,
          isNumber(bucketObjKey) ? undefined : bucketObjKey
        );
        const filter = structuredClone(bucket.filters) || currentAgg.createFilter(bucketKey);
        const newFilters = flatten([...filters, filter]);
        walkBucketTree(
          newAggIndex,
          bucket,
          newAgg.id,
          newFilters,
          `${key}${OTHER_NESTED_BUCKET_SEPARATOR}${bucketKey.toString()}`
        );
      });
      return;
    }

    const hasScriptedField = !!aggWithOtherBucket.params.field?.scripted;
    const hasMissingBucket = !!aggWithOtherBucket.params.missingBucket;
    const hasMissingBucketKey = agg.buckets.some(
      (bucket: { key: string }) => bucket.key === MISSING_KEY_STRING
    );
    if (
      aggWithOtherBucket.params.field &&
      !hasScriptedField &&
      (!hasMissingBucket || hasMissingBucketKey)
    ) {
      filters.push(
        buildExistsFilter(
          aggWithOtherBucket.params.field,
          aggWithOtherBucket.aggConfigs.indexPattern
        )
      );
    }

    // create not filters for all the buckets
    each(agg.buckets, (bucket) => {
      if (bucket.key === MISSING_KEY_STRING) return;
      const filter = currentAgg.createFilter(currentAgg.getKey(bucket, bucket.key));
      filter.meta.negate = true;
      filters.push(filter);
    });

    resultAgg.filters.filters[key] = {
      bool: buildQueryFromFilters(filters, indexPattern),
    };
  };
  walkBucketTree(
    0,
    getCorrectAggregationsCursorFromResponse(response, aggConfigs),
    bucketAggs[0].id,
    [],
    ''
  );

  // bail if there were no bucket results
  if (noAggBucketResults || exhaustiveBuckets) {
    return false;
  }

  return () => {
    if (aggConfigs.isSamplingEnabled()) {
      return {
        sampling: {
          ...createSamplerAgg(aggConfigs.samplerConfig),
          aggs: { 'other-filter': resultAgg },
        },
      };
    }
    return {
      'other-filter': resultAgg,
    };
  };
};

export const mergeOtherBucketAggResponse = (
  aggsConfig: IAggConfigs,
  response: estypes.SearchResponse<any>,
  otherResponse: any,
  otherAgg: IAggConfig,
  requestAgg: Record<string, any>,
  otherFilterBuilder: (requestAgg: Record<string, any>, key: string, otherAgg: IAggConfig) => Filter
): estypes.SearchResponse<any> => {
  const updatedResponse = structuredClone(response);
  const updatedOtherResponse = structuredClone(otherResponse);
  const aggregationsRoot = getCorrectAggregationsCursorFromResponse(
    updatedOtherResponse,
    aggsConfig
  );
  const updatedAggregationsRoot = getCorrectAggregationsCursorFromResponse(
    updatedResponse,
    aggsConfig
  );
  const buckets =
    'buckets' in aggregationsRoot!['other-filter'] ? aggregationsRoot!['other-filter'].buckets : {};
  each(buckets, (bucket, key) => {
    if (!bucket.doc_count || key === undefined) return;
    const bucketKey = key.replace(otherBucketRegexp, '');
    const aggResultBuckets = getAggResultBuckets(
      aggsConfig,
      updatedAggregationsRoot,
      otherAgg,
      bucketKey
    );
    const otherFilter = otherFilterBuilder(
      getCorrectAggCursorFromRequest(requestAgg, aggsConfig),
      key,
      otherAgg
    );
    bucket.filters = [otherFilter];
    bucket.key = '__other__';

    if (
      aggResultBuckets.some(
        (aggResultBucket: Record<string, any>) => aggResultBucket.key === MISSING_KEY_STRING
      )
    ) {
      bucket.filters.push(
        buildExistsFilter(otherAgg.params.field, otherAgg.aggConfigs.indexPattern)
      );
    }
    aggResultBuckets.push(bucket);
  });
  return updatedResponse;
};
export const updateMissingBucket = (
  response: estypes.SearchResponse<any>,
  aggConfigs: IAggConfigs,
  agg: IAggConfig
) => {
  const updatedResponse = structuredClone(response);
  const aggResultBuckets = getAggConfigResultMissingBuckets(
    getCorrectAggregationsCursorFromResponse(updatedResponse, aggConfigs),
    agg.id
  );
  aggResultBuckets.forEach((bucket) => {
    bucket.key = MISSING_KEY_STRING;
  });
  return updatedResponse;
};

export function constructSingleTermOtherFilter(
  requestAgg: Record<string, any>,
  key: string,
  otherAgg: IAggConfig
) {
  const requestFilterTerms = getOtherAggTerms(requestAgg, key, otherAgg);

  const phraseFilter = buildPhrasesFilter(
    otherAgg.params.field,
    requestFilterTerms,
    otherAgg.aggConfigs.indexPattern
  );
  phraseFilter.meta.negate = true;
  return phraseFilter;
}

export function constructMultiTermOtherFilter(
  requestAgg: Record<string, any>,
  key: string
): Filter {
  return {
    query: requestAgg['other-filter'].filters.filters[key],
    meta: {},
  };
}

export const createOtherBucketPostFlightRequest = (
  otherFilterBuilder: (requestAgg: Record<string, any>, key: string, otherAgg: IAggConfig) => Filter
) => {
  const postFlightRequest: IAggType['postFlightRequest'] = async (
    resp,
    aggConfigs,
    aggConfig,
    searchSource,
    inspectorRequestAdapter,
    abortSignal,
    searchSessionId,
    disableWarningToasts
  ) => {
    if (!resp.aggregations) return resp;
    const nestedSearchSource = searchSource.createChild();
    if (aggConfig.params.otherBucket) {
      const filterAgg = buildOtherBucketAgg(aggConfigs, aggConfig, resp);
      if (!filterAgg) return resp;

      nestedSearchSource.setField('aggs', filterAgg);

      const { rawResponse: otherResponse } = await lastValueFrom(
        nestedSearchSource.fetch$({
          abortSignal,
          sessionId: searchSessionId,
          disableWarningToasts,
          inspector: {
            adapter: inspectorRequestAdapter,
            title: i18n.translate('data.search.aggs.buckets.terms.otherBucketTitle', {
              defaultMessage: 'Other bucket',
            }),
            description: i18n.translate('data.search.aggs.buckets.terms.otherBucketDescription', {
              defaultMessage:
                'This request counts the number of documents that fall ' +
                'outside the criterion of the data buckets.',
            }),
          },
        })
      );

      resp = mergeOtherBucketAggResponse(
        aggConfigs,
        resp,
        otherResponse,
        aggConfig,
        filterAgg(),
        otherFilterBuilder
      );
    }
    if (aggConfig.params.missingBucket) {
      resp = updateMissingBucket(resp, aggConfigs, aggConfig);
    }
    return resp;
  };
  return postFlightRequest;
};
