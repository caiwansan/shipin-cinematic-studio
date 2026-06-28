/**
 * Narrative Audio Runtime — AudioSegment
 * 最小音频单元，系统任何播放器逻辑不得直接操作章节文本
 */
export interface AudioSegment {
    id: string;
    chapterId: string;
    text: string;
    speaker: string;
    emotion: string;
    sequence: number;
    estimatedDuration: number;
}
