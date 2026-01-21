/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { omitBy, isUndefined } from 'lodash';
import type { EncryptedSavedObjectsClient } from '@kbn/encrypted-saved-objects-plugin/server';
import type { Logger, SavedObjectsClientContract } from '@kbn/core/server';
import { SavedObjectsUtils } from '@kbn/core/server';
import { retryIfConflicts } from './retry_if_conflicts';
import type { ConnectorToken, UserConnectorToken } from '../types';
import {
  CONNECTOR_TOKEN_SAVED_OBJECT_TYPE,
  USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE,
} from '../constants/saved_objects';

export const MAX_TOKENS_RETURNED = 1;
const MAX_RETRY_ATTEMPTS = 3;

interface ConstructorOptions {
  encryptedSavedObjectsClient: EncryptedSavedObjectsClient;
  unsecuredSavedObjectsClient: SavedObjectsClientContract;
  logger: Logger;
}

interface CreateOptions {
  profileUid?: string;
  connectorId: string;
  token: string;
  expiresAtMillis?: string;
  tokenType?: string;
}

export interface UpdateOptions {
  id: string;
  token: string;
  expiresAtMillis?: string;
  tokenType?: string;
}

interface UpdateOrReplaceOptions {
  profileUid?: string;
  connectorId: string;
  token: ConnectorToken | UserConnectorToken | null;
  newToken: string;
  expiresInSec?: number;
  tokenRequestDate: number;
  deleteExisting: boolean;
}

type TokenType = ConnectorToken | UserConnectorToken;

interface TokenAttributes {
  connectorId: string;
  token: string;
  expiresAt?: string;
  tokenType: string;
  createdAt: string;
  updatedAt: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  profileUid?: string;
}

export class ConnectorTokenClient {
  private readonly logger: Logger;
  private readonly unsecuredSavedObjectsClient: SavedObjectsClientContract;
  private readonly encryptedSavedObjectsClient: EncryptedSavedObjectsClient;

  constructor({
    unsecuredSavedObjectsClient,
    encryptedSavedObjectsClient,
    logger,
  }: ConstructorOptions) {
    this.encryptedSavedObjectsClient = encryptedSavedObjectsClient;
    this.unsecuredSavedObjectsClient = unsecuredSavedObjectsClient;
    this.logger = logger;
  }

  private getSavedObjectType(profileUid?: string): string {
    return profileUid ? USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE : CONNECTOR_TOKEN_SAVED_OBJECT_TYPE;
  }

  private parseTokenId(id: string): {
    scope: 'personal' | 'shared';
    actualId: string;
  } {
    if (id.startsWith('personal:')) {
      return { scope: 'personal', actualId: id.substring(9) };
    }
    if (id.startsWith('shared:')) {
      return { scope: 'shared', actualId: id.substring(7) };
    }
    return { scope: 'shared', actualId: id };
  }

  private formatTokenId(rawId: string, scope: 'personal' | 'shared'): string {
    return `${scope}:${rawId}`;
  }

  // Creates a descriptive context string for logging
  private getContextString(profileUid?: string, connectorId?: string, tokenType?: string): string {
    const parts = [];
    if (profileUid) parts.push(`profileUid "${profileUid}"`);
    if (connectorId) parts.push(`connectorId "${connectorId}"`);
    if (tokenType) parts.push(`tokenType: "${tokenType}"`);
    return parts.join(', ');
  }

  /**
   * Create new token for connector
   */
  public async create({
    profileUid,
    connectorId,
    token,
    expiresAtMillis,
    tokenType,
  }: CreateOptions): Promise<TokenType> {
    const rawId = SavedObjectsUtils.generateId();
    const scope = profileUid ? 'personal' : 'shared';
    const id = this.formatTokenId(rawId, scope);
    const createTime = Date.now();
    const savedObjectType = this.getSavedObjectType(profileUid);
    const context = this.getContextString(profileUid, connectorId, tokenType ?? 'access_token');

    try {
      const attributes: Partial<TokenAttributes> = {
        connectorId,
        token,
        expiresAt: expiresAtMillis,
        tokenType: tokenType ?? 'access_token',
        createdAt: new Date(createTime).toISOString(),
        updatedAt: new Date(createTime).toISOString(),
      };

      if (profileUid) {
        attributes.profileUid = profileUid;
      }

      const result = await this.unsecuredSavedObjectsClient.create(savedObjectType, attributes, {
        id: rawId,
      });

      return { ...result.attributes, id } as TokenType;
    } catch (err) {
      this.logger.error(
        `Failed to create ${savedObjectType} for ${context}. Error: ${err.message}`
      );
      throw err;
    }
  }

  /**
   * Update connector token
   */
  public async update({
    id,
    token,
    expiresAtMillis,
    tokenType,
  }: UpdateOptions): Promise<TokenType | null> {
    const { scope, actualId } = this.parseTokenId(id);
    const savedObjectType =
      scope === 'personal'
        ? USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE
        : CONNECTOR_TOKEN_SAVED_OBJECT_TYPE;

    let attributes: TokenType;
    let references: unknown[];
    let version: string | undefined;

    try {
      const tokenResult = await this.unsecuredSavedObjectsClient.get<TokenType>(
        savedObjectType,
        actualId
      );
      attributes = tokenResult.attributes;
      references = tokenResult.references;
      version = tokenResult.version;
    } catch (err) {
      this.logger.error(`Failed to find token with id "${id}". Error: ${err.message}`);
      throw err;
    }

    const createTime = Date.now();
    const profileUid =
      'profileUid' in attributes && typeof attributes.profileUid === 'string'
        ? attributes.profileUid
        : undefined;
    const context = this.getContextString(
      profileUid,
      attributes.connectorId,
      tokenType ?? 'access_token'
    );

    try {
      const updateOperation = () => {
        // Exclude id from attributes since it's saved object metadata, not document data
        const { id: _id, ...attributesWithoutId } = attributes;
        return this.unsecuredSavedObjectsClient.create<TokenType>(
          savedObjectType,
          {
            ...attributesWithoutId,
            token,
            expiresAt: expiresAtMillis,
            tokenType: tokenType ?? 'access_token',
            updatedAt: new Date(createTime).toISOString(),
          },
          omitBy(
            {
              id: actualId,
              overwrite: true,
              references,
              version,
            },
            isUndefined
          )
        );
      };

      const result = await retryIfConflicts(
        this.logger,
        `connectorToken.update('${id}')`,
        updateOperation,
        MAX_RETRY_ATTEMPTS
      );

      return { ...result.attributes, id } as TokenType;
    } catch (err) {
      this.logger.error(
        `Failed to update ${savedObjectType} for id "${id}" with ${context}. Error: ${err.message}`
      );
      throw err;
    }
  }

  /**
   * Get connector token
   */
  public async get({
    profileUid,
    connectorId,
    tokenType,
  }: {
    profileUid?: string;
    connectorId: string;
    tokenType?: string;
  }): Promise<{
    hasErrors: boolean;
    connectorToken: TokenType | null;
  }> {
    const connectorTokensResult = [];
    const savedObjectType = this.getSavedObjectType(profileUid);
    const context = this.getContextString(profileUid, connectorId, tokenType ?? 'access_token');

    const tokenTypeFilter = tokenType
      ? ` AND ${savedObjectType}.attributes.tokenType: "${tokenType}"`
      : '';

    const profileUidFilter = profileUid
      ? `${savedObjectType}.attributes.profileUid: "${profileUid}" AND `
      : '';

    try {
      connectorTokensResult.push(
        ...(
          await this.unsecuredSavedObjectsClient.find<TokenType>({
            perPage: MAX_TOKENS_RETURNED,
            type: savedObjectType,
            filter: `${profileUidFilter}${savedObjectType}.attributes.connectorId: "${connectorId}"${tokenTypeFilter}`,
            sortField: 'updated_at',
            sortOrder: 'desc',
          })
        ).saved_objects
      );
    } catch (err) {
      this.logger.error(`Failed to fetch ${savedObjectType} for ${context}. Error: ${err.message}`);
      return { hasErrors: true, connectorToken: null };
    }

    if (connectorTokensResult.length === 0) {
      return { hasErrors: false, connectorToken: null };
    }

    let accessToken: string;
    try {
      const {
        attributes: { token },
      } = await this.encryptedSavedObjectsClient.getDecryptedAsInternalUser<TokenType>(
        savedObjectType,
        connectorTokensResult[0].id
      );

      accessToken = token;
    } catch (err) {
      this.logger.error(
        `Failed to decrypt ${savedObjectType} for ${context}. Error: ${err.message}`
      );
      return { hasErrors: true, connectorToken: null };
    }

    if (
      connectorTokensResult[0].attributes.expiresAt &&
      isNaN(Date.parse(connectorTokensResult[0].attributes.expiresAt))
    ) {
      this.logger.error(
        `Failed to get ${savedObjectType} for ${context}. Error: expiresAt is not a valid Date "${connectorTokensResult[0].attributes.expiresAt}"`
      );
      return { hasErrors: true, connectorToken: null };
    }

    return {
      hasErrors: false,
      connectorToken: {
        id: this.formatTokenId(connectorTokensResult[0].id, profileUid ? 'personal' : 'shared'),
        ...connectorTokensResult[0].attributes,
        token: accessToken,
      },
    };
  }

  /**
   * Delete all connector tokens
   */
  public async deleteConnectorTokens({
    profileUid,
    connectorId,
    tokenType,
  }: {
    profileUid?: string;
    connectorId: string;
    tokenType?: string;
  }) {
    const savedObjectType = this.getSavedObjectType(profileUid);
    const context = this.getContextString(profileUid, connectorId);

    const tokenTypeFilter = tokenType
      ? ` AND ${savedObjectType}.attributes.tokenType: "${tokenType}"`
      : '';

    const profileUidFilter = profileUid
      ? `${savedObjectType}.attributes.profileUid: "${profileUid}" AND `
      : '';

    try {
      const result = await this.unsecuredSavedObjectsClient.find<TokenType>({
        type: savedObjectType,
        filter: `${profileUidFilter}${savedObjectType}.attributes.connectorId: "${connectorId}"${tokenTypeFilter}`,
      });
      return Promise.all(
        result.saved_objects.map(
          async (obj) => await this.unsecuredSavedObjectsClient.delete(savedObjectType, obj.id)
        )
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete ${savedObjectType} records for ${context}. Error: ${err.message}`
      );
      throw err;
    }
  }

  public async updateOrReplace({
    profileUid,
    connectorId,
    token,
    newToken,
    expiresInSec,
    tokenRequestDate,
    deleteExisting,
  }: UpdateOrReplaceOptions) {
    expiresInSec = expiresInSec ?? 3600;
    tokenRequestDate = tokenRequestDate ?? Date.now();
    if (token === null) {
      if (deleteExisting) {
        await this.deleteConnectorTokens({
          profileUid,
          connectorId,
          tokenType: 'access_token',
        });
      }

      await this.create({
        profileUid,
        connectorId,
        token: newToken,
        expiresAtMillis: new Date(tokenRequestDate + expiresInSec * 1000).toISOString(),
        tokenType: 'access_token',
      });
    } else {
      await this.update({
        id: token.id!,
        token: newToken,
        expiresAtMillis: new Date(tokenRequestDate + expiresInSec * 1000).toISOString(),
        tokenType: 'access_token',
      });
    }
  }

  /**
   * Create new token with refresh token support
   */
  public async createWithRefreshToken({
    profileUid,
    connectorId,
    accessToken,
    refreshToken,
    expiresIn,
    refreshTokenExpiresIn,
    tokenType,
  }: {
    profileUid?: string;
    connectorId: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
    tokenType?: string;
  }): Promise<TokenType> {
    const rawId = SavedObjectsUtils.generateId();
    const scope = profileUid ? 'personal' : 'shared';
    const id = this.formatTokenId(rawId, scope);
    const now = Date.now();
    const expiresInMillis = expiresIn ? new Date(now + expiresIn * 1000).toISOString() : undefined;
    const refreshTokenExpiresInMillis = refreshTokenExpiresIn
      ? new Date(now + refreshTokenExpiresIn * 1000).toISOString()
      : undefined;

    const savedObjectType = this.getSavedObjectType(profileUid);
    const context = this.getContextString(profileUid, connectorId);

    try {
      const attributes: Partial<TokenAttributes> = omitBy(
        {
          connectorId,
          token: accessToken,
          refreshToken,
          expiresAt: expiresInMillis,
          refreshTokenExpiresAt: refreshTokenExpiresInMillis,
          tokenType: tokenType ?? 'access_token',
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        },
        isUndefined
      );

      if (profileUid) {
        attributes.profileUid = profileUid;
      }

      const result = await this.unsecuredSavedObjectsClient.create(savedObjectType, attributes, {
        id: rawId,
      });

      return { ...result.attributes, id } as TokenType;
    } catch (err) {
      this.logger.error(
        `Failed to create ${savedObjectType} with refresh token for ${context}. Error: ${err.message}`
      );
      throw err;
    }
  }

  /**
   * Update token with refresh token
   */
  public async updateWithRefreshToken({
    id,
    token,
    refreshToken,
    expiresIn,
    refreshTokenExpiresIn,
    tokenType,
  }: {
    id: string;
    token: string;
    refreshToken?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
    tokenType?: string;
  }): Promise<TokenType | null> {
    const { scope, actualId } = this.parseTokenId(id);
    const savedObjectType =
      scope === 'personal'
        ? USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE
        : CONNECTOR_TOKEN_SAVED_OBJECT_TYPE;

    let attributes: TokenType;
    let references: unknown[];
    let version: string | undefined;

    try {
      const tokenResult = await this.unsecuredSavedObjectsClient.get<TokenType>(
        savedObjectType,
        actualId
      );
      attributes = tokenResult.attributes;
      references = tokenResult.references;
      version = tokenResult.version;
    } catch (err) {
      this.logger.error(`Failed to find token with id "${id}". Error: ${err.message}`);
      throw err;
    }

    const now = Date.now();
    const expiresInMillis = expiresIn ? new Date(now + expiresIn * 1000).toISOString() : undefined;
    const refreshTokenExpiresInMillis = refreshTokenExpiresIn
      ? new Date(now + refreshTokenExpiresIn * 1000).toISOString()
      : undefined;

    const profileUid =
      'profileUid' in attributes && typeof attributes.profileUid === 'string'
        ? attributes.profileUid
        : undefined;
    const context = this.getContextString(profileUid, attributes.connectorId);

    try {
      const updateOperation = () => {
        // Exclude id from attributes since it's saved object metadata, not document data
        const { id: _id, ...attributesWithoutId } = attributes;
        return this.unsecuredSavedObjectsClient.create<TokenType>(
          savedObjectType,
          omitBy(
            {
              ...attributesWithoutId,
              token,
              refreshToken: refreshToken ?? attributes.refreshToken,
              expiresAt: expiresInMillis,
              refreshTokenExpiresAt:
                refreshTokenExpiresInMillis ?? attributes.refreshTokenExpiresAt,
              tokenType: tokenType ?? attributes.tokenType ?? 'access_token',
              updatedAt: new Date(now).toISOString(),
            },
            isUndefined
          ) as TokenType,
          omitBy(
            {
              id: actualId,
              overwrite: true,
              references,
              version,
            },
            isUndefined
          )
        );
      };

      const result = await retryIfConflicts(
        this.logger,
        `connectorToken.updateWithRefreshToken('${id}')`,
        updateOperation,
        MAX_RETRY_ATTEMPTS
      );

      return { ...result.attributes, id } as TokenType;
    } catch (err) {
      this.logger.error(
        `Failed to update ${savedObjectType} with refresh token for id "${id}" and ${context}. Error: ${err.message}`
      );
      throw err;
    }
  }
}
