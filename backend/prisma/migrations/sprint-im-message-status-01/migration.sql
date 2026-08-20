-- IM 消息状态追踪：已发送/已送达/已读
CREATE TABLE IF NOT EXISTS im_message_status (
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_type INTEGER NOT NULL DEFAULT 4,
    sender_uid TEXT NOT NULL,
    status SMALLINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_im_msg_status_channel ON im_message_status(channel_id, channel_type, updated_at);
CREATE INDEX IF NOT EXISTS idx_im_msg_status_sender ON im_message_status(sender_uid, status);

-- 会话已读水位
CREATE TABLE IF NOT EXISTS im_conversation_read (
    uid TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_type INTEGER NOT NULL DEFAULT 4,
    last_read_message_id TEXT,
    last_read_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (uid, channel_id, channel_type)
);
CREATE INDEX IF NOT EXISTS idx_im_conv_read_uid ON im_conversation_read(uid);

-- 输入状态
ALTER TABLE im_user_presence ADD COLUMN IF NOT EXISTS typing_in_channel TEXT;
ALTER TABLE im_user_presence ADD COLUMN IF NOT EXISTS typing_updated_at TIMESTAMP(3);

-- 引用回复
ALTER TABLE im_message_index ADD COLUMN IF NOT EXISTS reply_to_message_id TEXT;
