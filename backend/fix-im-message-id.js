const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/im.ts';
let code = fs.readFileSync(file, 'utf8');

// Fix: convert message_id to string in send-reply route
code = code.replace(
  'messageId: data.message_id,',
  'messageId: String(data.message_id),'
);

// Fix: convert message_id to string in messages/send route (if it exists)
code = code.replace(
  'messageId: data?.message_id',
  'messageId: String(data?.message_id)'
);

fs.writeFileSync(file, code);
console.log('Fixed message_id conversion');
