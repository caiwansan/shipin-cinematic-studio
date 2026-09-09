import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const refCode = body.refCode || '';
    
    if (!refCode) {
      return {
        code: 400,
        message: '邀请码不能为空',
        data: null
      };
    }
    
    // TODO: 验证邀请码并绑定推荐人
    
    return {
      code: 0,
      message: '绑定成功',
      data: null
    };
  } catch (error: any) {
    return {
      code: 500,
      message: error.message || '服务异常',
      data: null
    };
  }
});
