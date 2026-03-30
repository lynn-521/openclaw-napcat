// Continue testing remaining imports

// PAIRING_APPROVED_MESSAGE - need to find correct path
// Try from channel-status first (since discord exports it from there)
import { buildTokenChannelStatusSummary } from 'openclaw/plugin-sdk/channel-status';
console.log('channel-status has PAIRING_APPROVED_MESSAGE? (checking via buildTokenChannelStatusSummary)');

// Let's check if PAIRING_APPROVED_MESSAGE is in any of these modules
try {
  // Try importing from channel-status
  const cs = await import('openclaw/plugin-sdk/channel-status');
  console.log('channel-status exports:', Object.keys(cs));
} catch(e) {
  console.log('channel-status error:', e.message);
}

// Try channel-contract for ChannelAccountSnapshot
try {
  const cc = await import('openclaw/plugin-sdk/channel-contract');
  console.log('channel-contract exports (types/functions):', Object.keys(cc));
} catch(e) {
  console.log('channel-contract error:', e.message);
}

// Try channel-lifecycle for createAccountStatusSink
try {
  const cl = await import('openclaw/plugin-sdk/channel-lifecycle');
  console.log('channel-lifecycle exports:', Object.keys(cl));
} catch(e) {
  console.log('channel-lifecycle error:', e.message);
}

console.log('\n=== Type checking for ChannelDock ===');
// ChannelDock - check if it exists
try {
  // Check the type definitions via a type-only import would fail at runtime
  // Instead, let's check what channel exports
  const ch = await import('openclaw/plugin-sdk/channels');
  console.log('channels exports:', Object.keys(ch));
} catch(e) {
  console.log('channels error:', e.message);
}
