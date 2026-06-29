<template>
  <div class="geo-ko-detail-overlay" @click.self="$emit('close')">
    <div class="geo-ko-detail">
      <div class="geo-detail-header">
        <h3>{{ ko.topic || '知识对象详情' }}</h3>
        <button class="geo-modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="geo-detail-body">
        <!-- Entities -->
        <div class="geo-detail-section">
          <h4>Entities ({{ ko.entities?.length || 0 }})</h4>
          <div v-if="ko.entities && ko.entities.length > 0" class="geo-entity-list">
            <div v-for="(entity, i) in ko.entities" :key="i" class="geo-entity-item">
              <span class="geo-entity-name">{{ entity.name }}</span>
              <span class="geo-entity-type">{{ entity.type }}</span>
              <span class="geo-entity-desc">{{ entity.description }}</span>
            </div>
          </div>
          <div v-else class="geo-empty-inline">暂无实体</div>
        </div>

        <!-- Relations -->
        <div class="geo-detail-section">
          <h4>Relations ({{ ko.relations?.length || 0 }})</h4>
          <div v-if="ko.relations && ko.relations.length > 0" class="geo-relation-list">
            <div v-for="(rel, i) in ko.relations" :key="i" class="geo-relation-item">
              <span class="geo-rel-source">{{ rel.source }}</span>
              <span class="geo-rel-type">{{ rel.type }}</span>
              <span class="geo-rel-target">{{ rel.target }}</span>
            </div>
          </div>
          <div v-else class="geo-empty-inline">暂无关系</div>
        </div>

        <!-- Claims -->
        <div class="geo-detail-section">
          <h4>Claims ({{ ko.claims?.length || 0 }})</h4>
          <div v-if="ko.claims && ko.claims.length > 0" class="geo-list-items">
            <div v-for="(claim, i) in ko.claims" :key="i" class="geo-list-item">
              <p class="geo-list-text">{{ claim.text || claim }}</p>
              <span v-if="claim.type" class="geo-list-tag">{{ claim.type }}</span>
            </div>
          </div>
          <div v-else class="geo-empty-inline">暂无 Claim</div>
        </div>

        <!-- Evidence -->
        <div class="geo-detail-section">
          <h4>Evidence ({{ ko.evidence?.length || 0 }})</h4>
          <div v-if="ko.evidence && ko.evidence.length > 0" class="geo-list-items">
            <div v-for="(ev, i) in ko.evidence" :key="i" class="geo-list-item">
              <p class="geo-list-text">{{ ev.content || ev }}</p>
              <span v-if="ev.source" class="geo-list-source">{{ ev.source }}</span>
            </div>
          </div>
          <div v-else class="geo-empty-inline">暂无 Evidence</div>
        </div>

        <!-- Citations -->
        <div class="geo-detail-section">
          <h4>Citations ({{ ko.citations?.length || 0 }})</h4>
          <div v-if="ko.citations && ko.citations.length > 0" class="geo-list-items">
            <div v-for="(cit, i) in ko.citations" :key="i" class="geo-list-item geo-citation-item">
              <p class="geo-list-text">{{ cit.citationText || cit }}</p>
              <div v-if="cit.sourceUrl" class="geo-citation-url">
                <a :href="cit.sourceUrl" target="_blank" rel="noopener">{{ cit.sourceUrl }}</a>
              </div>
            </div>
          </div>
          <div v-else class="geo-empty-inline">暂无 Citation</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  ko: any
}>()

defineEmits<{
  close: []
}>()
</script>

<style scoped>
.geo-ko-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-ko-detail { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); width: 720px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-detail-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; position: sticky; top: 0; background: #1a1a2e; z-index: 1; }
.geo-detail-header h3 { margin: 0; font-size: 18px; font-weight: 700; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-detail-body { padding: 16px 20px 20px; }
.geo-detail-section { margin-bottom: 20px; }
.geo-detail-section h4 { font-size: 14px; font-weight: 600; color: #aaa; margin: 0 0 8px; }
.geo-entity-list, .geo-relation-list { display: flex; flex-direction: column; gap: 6px; }
.geo-entity-item, .geo-relation-item { padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 13px; display: flex; gap: 8px; flex-wrap: wrap; }
.geo-entity-name { font-weight: 600; }
.geo-entity-type { padding: 1px 6px; border-radius: 4px; font-size: 10px; background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-entity-desc { color: #888; font-size: 12px; width: 100%; }
.geo-rel-source { color: #818cf8; }
.geo-rel-type { color: #fbbf24; font-size: 11px; }
.geo-rel-target { color: #34d399; }
.geo-list-items { display: flex; flex-direction: column; gap: 6px; }
.geo-list-item { padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 13px; }
.geo-list-text { margin: 0 0 4px; }
.geo-list-tag { font-size: 10px; color: #818cf8; background: rgba(129,140,248,0.1); padding: 1px 6px; border-radius: 4px; }
.geo-list-source { font-size: 11px; color: #6b7280; }
.geo-citation-url { margin-top: 4px; font-size: 11px; }
.geo-citation-url a { color: #818cf8; text-decoration: none; }
.geo-citation-url a:hover { text-decoration: underline; }
.geo-empty-inline { color: #6b7280; font-size: 13px; padding: 8px 0; }
</style>
