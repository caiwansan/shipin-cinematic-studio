import { defineEventHandler, createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // TODO: 检查当前用户是否需要绑定推荐人
    return {
      code: 0,
      message: 'ok',
      data: {
        needBind: false
      }
    };
  } catch (error: any) {
    return {
      code: 500,
      message: error.message || '服务异常',
      data: null
    };
  }
});
