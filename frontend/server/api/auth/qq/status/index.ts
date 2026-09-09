import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  return {
    code: 0,
    message: 'ok',
    data: {
      enabled: true
    }
  };
});
