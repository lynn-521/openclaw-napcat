// Test each SDK import from its CORRECT module path

// 1. account-id (verified working)
import { normalizeAccountId, DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk/account-id';
console.log('✅ account-id: normalizeAccountId, DEFAULT_ACCOUNT_ID');

// 2. channel-status
import { buildTokenChannelStatusSummary } from 'openclaw/plugin-sdk/channel-status';
console.log('✅ channel-status: buildTokenChannelStatusSummary');

// 3. channel-send-result  
import { buildChannelSendResult } from 'openclaw/plugin-sdk/channel-send-result';
console.log('✅ channel-send-result: buildChannelSendResult');

// 4. status-helpers
import { buildBaseAccountStatusSnapshot } from 'openclaw/plugin-sdk/status-helpers';
console.log('✅ status-helpers: buildBaseAccountStatusSnapshot');

// 5. core - config functions
import { 
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  applyAccountNameToChannelSection,
  migrateBaseNameToDefaultAccount
} from 'openclaw/plugin-sdk/core';
console.log('✅ core: deleteAccountFromConfigSection, setAccountEnabledInConfigSection, applyAccountNameToChannelSection, migrateBaseNameToDefaultAccount');

// 6. setup
import { applySetupAccountConfigPatch } from 'openclaw/plugin-sdk/setup';
console.log('✅ setup: applySetupAccountConfigPatch');

// 7. matrix
import { chunkTextForOutbound } from 'openclaw/plugin-sdk/matrix';
console.log('✅ matrix: chunkTextForOutbound');

// 8. reply-payload
import { isNumericTargetId, sendPayloadWithChunkedTextAndMedia } from 'openclaw/plugin-sdk/reply-payload';
console.log('✅ reply-payload: isNumericTargetId, sendPayloadWithChunkedTextAndMedia');

// 9. channel-config-helpers (these ARE in compat)
import { 
  buildAccountScopedDmSecurityPolicy,
  mapAllowFromEntries 
} from 'openclaw/plugin-sdk/channel-config-helpers';
console.log('✅ channel-config-helpers: buildAccountScopedDmSecurityPolicy, mapAllowFromEntries');

// 10. channel-policy (these ARE in compat)
import { 
  collectOpenProviderGroupPolicyWarnings,
  buildOpenGroupPolicyRestrictSendersWarning,
  buildOpenGroupPolicyWarning
} from 'openclaw/plugin-sdk/channel-policy';
console.log('✅ channel-policy: collectOpenProviderGroupPolicyWarnings, buildOpenGroupPolicyRestrictSendersWarning, buildOpenGroupPolicyWarning');

// 11. allow-from (these ARE in compat)
import { formatAllowFromLowercase } from 'openclaw/plugin-sdk/allow-from';
console.log('✅ allow-from: formatAllowFromLowercase');

// 12. directory-runtime
import { listDirectoryUserEntriesFromAllowFrom } from 'openclaw/plugin-sdk/directory-runtime';
console.log('✅ directory-runtime: listDirectoryUserEntriesFromAllowFrom');

console.log('\n=== All SDK imports verified successfully ===');
