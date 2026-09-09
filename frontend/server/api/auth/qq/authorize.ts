import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const ref = String(query.ref || '');
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);

    const params = [
      'response_type=code',
      'client_id=1905458744',
      'redirect_uri=' + encodeURIComponent('https://aigc.fushtn.com/auth/qq/callback'),
      'state=' + encodeURIComponent(state),
      'scope=get_user_info'
    ];

    const authUrl = 'https://graph.qq.com/oauth2.0/authorize?' + params.join('&');

    return {
      code: 0,
      message: 'ok',
      data: { authUrl: authUrl, state: state }
    };
  } catch (error) {
    return {
      code: 500,
      message: error.message || 'QQ授权服务异常',
      data: null
    };
  }
});
