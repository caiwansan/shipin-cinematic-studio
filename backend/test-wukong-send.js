const IM_HTTP_ADDR = 'http://127.0.0.1:5001';

async function test() {
  const channelId = 'test_' + Date.now();
  
  // Create channel
  const chRes = await fetch(IM_HTTP_ADDR + '/channel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4 })
  });
  console.log('Channel create:', chRes.status, await chRes.text());
  
  // Add subscribers
  const subRes = await fetch(IM_HTTP_ADDR + '/channel/subscriber_add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id: channelId, channel_type: 4, subscribers: ['user1', 'user2'] })
  });
  console.log('Subscriber add:', subRes.status, await subRes.text());
  
  // Test message send with base64 payload (correct format)
  const payload = Buffer.from(JSON.stringify({ type: 1, content: 'Hello World' })).toString('base64');
  console.log('Payload (base64):', payload);
  
  const msgRes = await fetch(IM_HTTP_ADDR + '/message/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id: channelId,
      channel_type: 4,
      from_uid: 'user1',
      payload: payload
    })
  });
  console.log('Message send:', msgRes.status, await msgRes.text());
}

test().catch(e => console.error('Error:', e.message));
