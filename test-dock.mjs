// Check for ChannelDock
try {
  const cpc = await import('openclaw/plugin-sdk/channel-plugin-common');
  console.log('channel-plugin-common exports:', Object.keys(cpc));
} catch(e) {
  console.log('channel-plugin-common error:', e.message);
}

try {
  const cp = await import('openclaw/plugin-sdk/channel');
  console.log('channel exports:', Object.keys(cp));
} catch(e) {
  console.log('channel error:', e.message);
}

try {
  const cpa = await import('openclaw/plugin-sdk/channel-accounts');
  console.log('channel-accounts exports:', Object.keys(cpa));
} catch(e) {
  console.log('channel-accounts error:', e.message);
}

try {
  const cpp = await import('openclaw/plugin-sdk/channel-policy');
  console.log('channel-policy exports:', Object.keys(cpp));
} catch(e) {
  console.log('channel-policy error:', e.message);
}
