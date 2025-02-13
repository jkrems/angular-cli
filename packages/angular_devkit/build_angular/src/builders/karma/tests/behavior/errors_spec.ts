/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { execute } from '../../index';
import { BASE_OPTIONS, KARMA_BUILDER_INFO, describeKarmaBuilder } from '../setup';

class StdoutCapture {
  private originalWrite: typeof process.stdout.write;
  private stdout: Array<Buffer> = [];

  constructor() {
    this.originalWrite = process.stdout.write;
    process.stdout.write = ((
      str: Uint8Array | string,
      encoding?: BufferEncoding,
      cb?: (err?: Error) => void,
    ) => {
      this.stdout.push(Buffer.from(str));
      return this.originalWrite.call(process.stdout, str, encoding, cb);
    }) as typeof process.stdout.write;
  }

  toString() {
    return Buffer.concat(this.stdout).toString();
  }

  release() {
    process.stdout.write = this.originalWrite;
  }
}

describeKarmaBuilder(execute, KARMA_BUILDER_INFO, (harness, setupTarget) => {
  describe('Behavior: "Errors"', () => {
    beforeEach(async () => {
      await setupTarget(harness);
    });

    it('should fail when there is a TypeScript error', async () => {
      harness.useTarget('test', {
        ...BASE_OPTIONS,
      });

      await harness.appendToFile('src/app/app.component.spec.ts', `console.lo('foo')`);

      const { result } = await harness.executeOnce({
        outputLogsOnFailure: false,
      });

      expect(result?.success).toBeFalse();
    });

    fit('should report failures with correct source locations', async () => {
      await harness.writeFiles({
        './src/app/app.component.spec.ts': `
            import { AppComponent } from './app.component';

            describe('Forced test failure', () => {
              it('makes an invalid call', () => {
                // @ts-ignore
                expect(AppComponent()).toBe(true);
              });
            });`,
      });

      harness.useTarget('test', {
        ...BASE_OPTIONS,
      });

      const stdout = new StdoutCapture();
      try {
        const { result } = await harness.executeOnce({
          outputLogsOnFailure: false,
        });
        expect(result?.success).toBeFalse();
      } finally {
        stdout.release();
      }

      expect(stdout.toString()).toMatch(/src\/app\/app\.component\.spec\.ts:7/);
    });
  });
});
