/**
 * Brand OS Design System — Motion Tokens
 * DS-1.6 Duration & Easing
 *
 * Consistent motion tokens for hover, toggle, page transitions, and score animations.
 */

export interface MotionToken {
  duration: string
  easing: string
}

export interface MotionTokens {
  fast: MotionToken
  normal: MotionToken
  slow: MotionToken
}

export const motionTokens: MotionTokens = {
  fast: { duration: '100ms', easing: 'ease-out' },
  normal: { duration: '200ms', easing: 'ease-out' },
  slow: { duration: '400ms', easing: 'ease-in-out' },
}

export const cssMotionVariables = `:root {
  --motion-fast-duration: ${motionTokens.fast.duration};
  --motion-fast-easing: ${motionTokens.fast.easing};
  --motion-normal-duration: ${motionTokens.normal.duration};
  --motion-normal-easing: ${motionTokens.normal.easing};
  --motion-slow-duration: ${motionTokens.slow.duration};
  --motion-slow-easing: ${motionTokens.slow.easing};
}`
