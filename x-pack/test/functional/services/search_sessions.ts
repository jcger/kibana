/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ELASTIC_HTTP_VERSION_HEADER } from '@kbn/core-http-common';
import { INITIAL_SEARCH_SESSION_REST_VERSION } from '@kbn/data-plugin/server';
import expect from '@kbn/expect';
import { SavedObjectsFindResponse } from '@kbn/core/server';
import { WebElementWrapper } from '@kbn/ftr-common-functional-ui-services';
import { FtrService } from '../ftr_provider_context';

const SEARCH_SESSION_INDICATOR_TEST_SUBJ = 'searchSessionIndicator';
const SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ = 'searchSessionIndicatorPopoverContainer';

export const TOUR_TAKING_TOO_LONG_STEP_KEY = `data.searchSession.tour.takingTooLong`;
export const TOUR_RESTORE_STEP_KEY = `data.searchSession.tour.restore`;

type SessionStateType =
  | 'none'
  | 'loading'
  | 'completed'
  | 'backgroundLoading'
  | 'backgroundCompleted'
  | 'restored'
  | 'canceled';

export class SearchSessionsService extends FtrService {
  private readonly testSubjects = this.ctx.getService('testSubjects');
  private readonly log = this.ctx.getService('log');
  private readonly retry = this.ctx.getService('retry');
  private readonly browser = this.ctx.getService('browser');
  private readonly security = this.ctx.getService('security');
  private readonly es = this.ctx.getService('es');

  public async find(): Promise<WebElementWrapper> {
    return this.testSubjects.find(SEARCH_SESSION_INDICATOR_TEST_SUBJ);
  }

  public async exists(): Promise<boolean> {
    return this.testSubjects.exists(SEARCH_SESSION_INDICATOR_TEST_SUBJ);
  }

  public async missingOrFail(): Promise<void> {
    return this.testSubjects.missingOrFail(SEARCH_SESSION_INDICATOR_TEST_SUBJ);
  }

  public async disabledOrFail() {
    await this.exists();
    await expect(await (await this.find()).getAttribute('data-save-disabled')).to.be('true');
  }

  public async expectState(state: SessionStateType, timeout = 10000) {
    return this.retry.waitForWithTimeout(
      `searchSessions indicator to get into state = ${state}`,
      timeout,
      async () => {
        const currentState = await (
          await this.testSubjects.find(SEARCH_SESSION_INDICATOR_TEST_SUBJ)
        ).getAttribute('data-state');
        this.log.info(`searchSessions state current: ${currentState} expected: ${state}`);
        return currentState === state;
      }
    );
  }

  public async viewSearchSessions() {
    this.log.debug('viewSearchSessions');
    await this.ensurePopoverOpened();
    await this.testSubjects.click('searchSessionIndicatorViewSearchSessionsLink');
  }

  public async save({ searchSessionName }: { searchSessionName?: string } = {}) {
    this.log.debug('save the search session');
    await this.ensurePopoverOpened();
    await this.testSubjects.click('searchSessionIndicatorSaveBtn');

    if (searchSessionName) {
      await this.testSubjects.click('searchSessionNameEdit');
      await this.testSubjects.setValue('searchSessionNameInput', searchSessionName, {
        clearWithKeyboard: true,
      });
      await this.testSubjects.click('searchSessionNameSave');
    }

    await this.ensurePopoverClosed();
  }

  public async cancel() {
    this.log.debug('cancel the search session');
    await this.ensurePopoverOpened();
    await this.testSubjects.click('searchSessionIndicatorCancelBtn');
    await this.ensurePopoverClosed();
  }

  public async openPopover() {
    await this.ensurePopoverOpened();
  }

  public async openedOrFail() {
    return this.testSubjects.existOrFail(SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ, {
      timeout: 15000, // because popover auto opens after search takes 10s
    });
  }

  public async closedOrFail() {
    return this.testSubjects.missingOrFail(SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ, {
      timeout: 15000, // because popover auto opens after search takes 10s
    });
  }

  private async ensurePopoverOpened() {
    this.log.debug('ensurePopoverOpened');
    const isAlreadyOpen = await this.testSubjects.exists(SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ);
    if (isAlreadyOpen) {
      this.log.debug('Popover is already open');
      return;
    }
    return this.retry.waitFor(`searchSessions popover opened`, async () => {
      await this.testSubjects.click(SEARCH_SESSION_INDICATOR_TEST_SUBJ);
      return await this.testSubjects.exists(SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ);
    });
  }

  private async ensurePopoverClosed() {
    this.log.debug('ensurePopoverClosed');
    const isAlreadyClosed = !(await this.testSubjects.exists(
      SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ
    ));
    if (isAlreadyClosed) return;
    return this.retry.waitFor(`searchSessions popover closed`, async () => {
      await this.browser.pressKeys(this.browser.keys.ESCAPE);
      return !(await this.testSubjects.exists(SEARCH_SESSIONS_POPOVER_CONTENT_TEST_SUBJ));
    });
  }

  /*
   * This cleanup function should be used by tests that create new search sessions.
   * Tests should not end with new search sessions remaining in storage since that interferes with functional tests that check the _find API.
   * Alternatively, a test can navigate to `Management > Search Sessions` and use the UI to delete any created tests.
   */
  public async deleteAllSearchSessions() {
    this.log.debug('Deleting created search sessions');
    // ignores 409 errs and keeps retrying
    await this.retry.tryForTime(10000, async () => {
      const { body } = await this.security.testUserSupertest
        .post('/internal/session/_find')
        .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_SEARCH_SESSION_REST_VERSION)
        .set('kbn-xsrf', 'anything')
        .set('kbn-system-request', 'true')
        .send({
          page: 1,
          perPage: 10000,
          sortField: 'created',
          sortOrder: 'asc',
        })
        .expect(200);

      const { saved_objects: savedObjects } = body as SavedObjectsFindResponse;

      if (savedObjects.length > 0) {
        this.log.debug(`Found created search sessions: ${savedObjects.map(({ id }) => id)}`);
      } else {
        this.log.debug(`Found no search sessions to delete`);
        return;
      }

      await Promise.all(
        savedObjects.map(async (so) => {
          this.log.debug(`Deleting search session: ${so.id}`);
          await this.security.testUserSupertest
            .delete(`/internal/session/${so.id}`)
            .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_SEARCH_SESSION_REST_VERSION)
            .set(`kbn-xsrf`, `anything`)
            .expect(200);
        })
      );
    });
  }

  public async markTourDone() {
    await Promise.all([
      this.browser.setLocalStorageItem(TOUR_TAKING_TOO_LONG_STEP_KEY, 'true'),
      this.browser.setLocalStorageItem(TOUR_RESTORE_STEP_KEY, 'true'),
    ]);
  }

  public async markTourUndone() {
    await Promise.all([
      this.browser.removeLocalStorageItem(TOUR_TAKING_TOO_LONG_STEP_KEY),
      this.browser.removeLocalStorageItem(TOUR_RESTORE_STEP_KEY),
    ]);
  }

  public async getAsyncSearchStatus(asyncSearchId: string) {
    const asyncSearchStatus = await this.es.asyncSearch.status({ id: asyncSearchId });
    return asyncSearchStatus;
  }

  public async getAsyncSearchExpirationTime(asyncSearchId: string): Promise<number> {
    const asyncSearchStatus = await this.getAsyncSearchStatus(asyncSearchId);
    return Number(asyncSearchStatus.expiration_time_in_millis);
  }
}
