# TUI Testing Strategy

## Current Issue
- TUI log viewer expects logs in `v3/logs/{sessionId}.log`
- AFk actually stores logs in `afk_registry/{sessionId}/worker.log`
- Fixed path in logs-viewer.js but need to verify it works

## E2E Testing with Microsoft's tui-test

Based on research, we should use Microsoft's `@microsoft/tui-test` framework:

```bash
npm install --save-dev @microsoft/tui-test
```

### Basic Test Structure
```javascript
const { TuiTest } = require('@microsoft/tui-test');

describe('Calmhive TUI', () => {
  let tui;
  
  beforeEach(async () => {
    tui = new TuiTest({
      command: 'node',
      args: ['bin/calmhive', 'tui']
    });
    await tui.start();
  });
  
  afterEach(async () => {
    await tui.stop();
  });
  
  it('should display AFk sessions', async () => {
    await tui.waitForText('AFk session afk-22099681-vv9i2dxy');
    expect(tui.screen).toContain('Research advanced Claude prompting');
  });
  
  it('should show logs when navigating to logs view', async () => {
    // Navigate to logs view
    await tui.send('l'); // or whatever key opens logs
    await tui.waitForText('Session Logs');
    await tui.waitForText('AFk worker started');
  });
});
```

## Manual Test for Log Fix
1. Start TUI: `node bin/calmhive tui`
2. Navigate to active AFk session 
3. Open logs viewer
4. Verify logs from afk_registry are displayed

## Test Data
- Active session: afk-22099681-vv9i2dxy
- Log file: ~/.claude/afk_registry/afk-22099681-vv9i2dxy/worker.log
- Expected content: "AFk worker started for session"