const IM_HTTP_ADDR = 'http://127.0.0.1:5001';

async function test() {
  try {
    // Test channel creation
    const chRes = await fetch(IM_HTTP_ADDR + '/channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: 'test_channel', channel_type: 4 })
    });
    console.log('Channel create:', chRes.status, await chRes.text());
    
    // Test subscriber add
    const subRes = await fetch(IM_HTTP_ADDR + '/channel/subscriber_add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: 'test_channel', channel_type: 4, subscribers: ['user1', 'user2'] })
    });
    console.log('Subscriber add:', subRes.status, await subRes.text());
    
    // Test message send
    const msgRes = await fetch(IM_HTTP_ADDR + '/message/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: 'test_channel',
        channel_type: 4,
        from_uid: 'user1',
        payload: { type: 1, content: 'Hello' }
      })
    });
    console.log('Message send:', msgRes.status, await msgRes.text());
    
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
