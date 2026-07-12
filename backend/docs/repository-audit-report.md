# Repository Audit Report

Generated: 2026-07-02T20:12:57.201Z

## Summary
- Total findings: 236
- Errors: 0
- Warnings: 236

## Models in Schema

### AiStageModelConfig
- Fields: stage, provider, model, size, params

### User
- Fields: id, email, username, passwordHash, phone, phoneVerified, memberTier, memberExpiresAt, createdAt, wechatOpenId, tokenVersion, qqOpenId, marketAgentId, agentPlanId, agentExpiresAt, agentLevel, agentStatus, agentCreatedAt, provinceCode, provinceName, cityCode, cityName, districtCode, districtName, updatedAt, lastActiveAt, comments, dna, dailyUsage, membership, projects, userModelConfigV2, communityCommentLikes, communityComments, communityLikes, communityPosts, communityRewards, messagesSent, messagesReceived, ownedProjects

### CreatorDnaProfile
- Fields: id, userId, cinematicStyleSignature, pacingProfile, emotionalProfile, visualProfile, directorSpeciesType, dominantGenres, creatorRank, updatedAt, createdAt, user

### Captcha
- Fields: id, token, code, expiresAt, used, createdAt

### SmsCode
- Fields: id, phone, code, expiresAt, used, createdAt

### EmailCode
- Fields: id, email, code, expiresAt, used, createdAt

### Project
- Fields: id, name, description, status, version, userId, tenantId, ownerId, type, resourceCount, lastExecutionAt, lastActivityAt, tenant, owner, geoProfile, budgetLimit, budgetSpent, budgetAlertAt, budgetNotified, executionResults, mergedVideoUrl, mergeStatus, runtimeCheckpoint, failureEvents, executionJournal, script, plotBlueprint, continuationFrom, workspaceId, createdAt, updatedAt, assets, assetGraphEdges, assetRegistries, characterProfiles, continuities, user, workspace, sceneProfiles, storyboards, videoTasks, aiActionSpecs, aiCameraSpecs, aiCharacterSpecs, aiEffectSpecs, aiEmotionSpecs, aiFrameDesigns, aiPropSpecs, aiSceneSpecs, aiSegmentEdits, aiVideoProduction, aiVideoSegments, aiVoiceConfigs, characterImages, characterReferences, exportTasks, frameImages, pipelineJobs, pipelineStages, propImages, sceneImages, sceneReferences, storyboardImages, ttsRecords

### AiCharacterSpec
- Fields: id, projectId, characterName, variant, gender, age, role, voiceType, physicalDescription, clothing, imagePrompt, negativePrompt, referenceImageUrl, confirmed, sortOrder, createdAt, updatedAt, project

### TTSRecord
- Fields: id, projectId, characterName, voiceId, audioUrl, duration, sequenceIndex, text, createdAt, project

### AiSceneSpec
- Fields: id, projectId, sceneId, sceneName, description, type, timeOfDay, lighting, mood, colorTone, environment, imagePrompt, negativePrompt, aspectRatio, confirmed, sortOrder, createdAt, updatedAt, project

### ImagePromptTemplates
- Fields: id, type, templateKey, title, content, sortOrder, enabled, description, createdAt, updatedAt

### AiVoiceConfig
- Fields: id, projectId, characterName, voiceType, speakingStyle, pitch, speed, ttsPrompt, audioUrl, voiceId, confirmed, sortOrder, createdAt, updatedAt, project

### AiVideoSegment
- Fields: id, projectId, segmentId, title, associatedScenes, duration, narrativePurpose, fullText, shotPattern, emotionArc, backgroundMusic, videoUrl, firstFrameUrl, midFrameUrl, lastFrameUrl, firstFrameDesc, midFrameDesc, lastFrameDesc, confirmed, sortOrder, createdAt, updatedAt, narrative, project

### AiSegmentEdit
- Fields: id, projectId, segmentId, narrative, dialogue, effects, emotion, negativePrompt, duration, firstFramePrompt, firstFrameNeg, midFramePrompt, midFrameNeg, lastFramePrompt, lastFrameNeg, charImageUrls, sceneImageUrls, propImageUrls, createdAt, updatedAt, project

### AiFrameDesign
- Fields: id, projectId, segmentId, firstFrameDesc, firstFramePrompt, firstFrameAngle, lastFrameDesc, lastFramePrompt, lastFrameAngle, confirmed, sortOrder, createdAt, updatedAt, project

### AiVideoProduction
- Fields: id, projectId, overallStyle, fps, resolution, colorPalette, transitionStyle, subtitleStyle, globalNegativePrompt, createdAt, updatedAt, project

### AiEffectSpec
- Fields: id, projectId, effectName, effectType, triggerScene, triggerEvent, visualDescription, colorPalette, duration, intensity, notes, sortOrder, createdAt, updatedAt, project

### AiActionSpec
- Fields: id, projectId, characterName, actionName, triggerCondition, movementDesc, facialExpression, bodyLanguage, cameraFocus, duration, sortOrder, createdAt, updatedAt, project

### AiPropSpec
- Fields: id, projectId, name, category, description, sceneIds, characterNames, imagePrompt, sortOrder, confirmed, createdAt, updatedAt, project

### AiCameraSpec
- Fields: id, projectId, segmentId, cameraMovement, shotSize, angle, duration, transition, purpose, sortOrder, createdAt, updatedAt, project

### AiEmotionSpec
- Fields: id, projectId, characterName, emotionType, intensity, facialDesc, bodyLanguage, voiceTone, triggerEvent, timing, cameraPreference, sortOrder, createdAt, updatedAt, project

### Storyboard
- Fields: id, projectId, shotIndex, duration, shotType, subject, action, expression, cameraMovement, lens, lighting, emotion, environment, cinematicStyle, colorStyle, realism, motionBlur, continuityNotes, negativePrompt, storyboardImage, startFrame, endFrame, createdAt, project, videoTask

### VideoTask
- Fields: id, projectId, storyboardId, status, progress, error, idempotencyKey, lockedBy, heartbeatAt, retryCount, maxRetries, priority, taskType, scheduledFor, completedAt, createdAt, updatedAt, taskLogs, segments, project, storyboard

### VideoSegment
- Fields: id, taskId, shotIndex, filePath, thumbnailPath, duration, status, createdAt, task

### ExportTask
- Fields: id, userId, projectId, status, exportType, progress, outputUrl, packageSize, error, traceId, createdAt, completedAt, project

### CharacterProfile
- Fields: id, projectId, name, age, gender, face, hair, clothes, body, identity, speakingStyle, personality, frontImage, sideImage, fullBodyImage, expressionImage, createdAt, project

### SceneProfile
- Fields: id, projectId, location, architecture, weather, lighting, timeOfDay, atmosphere, colorPalette, referenceImage, createdAt, project

### StyleProfile
- Fields: id, name, displayName, icon, description, styleTokens, negativeTokens

### PromptTemplate
- Fields: id, name, description, category, content, variables, createdAt

### Asset
- Fields: id, projectId, type, fileName, filePath, mimeType, fileSize, width, height, duration, taskId, createdAt, project

### Membership
- Fields: id, userId, tier, credits, creditsUsed, storageUsed, storageLimit, agentLevel, parentId, monthlyBudget, monthlySpent, monthlyResetAt, expiresAt, createdAt, updatedAt, coinLogs, parent, children, user, orders, storagePacks, assets

### CoinLog
- Fields: id, userId, amount, type, remark, relatedId, createdAt, membership

### UserAsset
- Fields: id, userId, title, type, url, thumbnail, prompt, style, mode, fileSize, isFeatured, source, modifiedBy, universeScore, cinematicScore, narrativeScore, emotionalScore, consistencyScore, renderQualityScore, worldDepthScore, engagementScore, retentionScore, freshnessScore, universeClusterId, createdAt, comments, likes, cluster, membership

### UniverseCluster
- Fields: id, name, genre, description, embeddingCenter, activityScore, evolutionState, workCount, createdAt, updatedAt, assets

### AssetLike
- Fields: id, assetId, userId, createdAt, asset

### AssetComment
- Fields: id, assetId, userId, content, createdAt, asset, user

### RechargeOrder
- Fields: id, userId, orderNo, planLevel, coins, amount, status, payMethod, accountName, tradeNo, remark, payTime, createdAt, updatedAt, membership

### MemberPlan
- Fields: id, level, name, price, originalPrice, months, storageLimit, dailyQuota, maxResolution, maxDuration, concurrentTasks, watermark, apiAccess, coins, icon, color, sortOrder, enabled, onlineApiEnabled, localModelEnabled, renewable, dayPrice, firstPurchaseOnly, updatedAt, createdAt

### StoragePack
- Fields: id, userId, size, coins, startAt, expireAt, createdAt, membership

### AgentLevelConfig
- Fields: id, level, name, priceCoins, discount, createdAt

### TaskLog
- Fields: id, taskId, level, message, metadata, eventId, createdAt, task

### WorkerRegistration
- Fields: id, hostname, version, status, capacity, currentLoad, healthy, tags, capabilities

### WorkerTaskAssignment
- Fields: id, workerId, taskId, startedAt, estimatedDuration, actualResponseTime, worker

### WorkerHealthHistory
- Fields: id, workerId, score, healthy, load, recordedAt, worker

### DeadLetterTask
- Fields: id, originalTaskId, projectId, taskType, error, retryCount, lastErrorAt, createdAt

### AiModel
- Fields: id, name, provider, modelType, taskTypes, status, deprecateAt, costPerRequest, costPerToken, costUnit, qualityScore, avgLatency, successCount, failureCount, totalCost, rateLimit, dailyTokenLimit, concurrencyMax, currentLoad, endpointUrl, apiKeyRef, params, createdAt, updatedAt, fallbackTo, fallbackFrom

### AiFallbackRule
- Fields: id, taskType, priority, primaryId, fallbackId, condition, createdAt, fallback, primary

### AiRoutingPolicy
- Fields: id, name, description, weightCost, weightQuality, weightLatency, weightSuccess, isDefault, createdAt

### AiTaskTypeMapping
- Fields: id, taskType, description, modelIds, policyId, createdAt

### AiExecutionLog
- Fields: id, taskId, projectId, modelId, taskType, requestType, status, latency, cost, tokensInput, tokensOutput, error, policyUsed, scoreBefore, scoreAfter, createdAt

### AiCircuitBreaker
- Fields: id, modelId, state, failureCount, successCount, failureThreshold, successThreshold, resetTimeoutMs, lastFailureAt, lastSuccessAt, openedAt, halfOpenAt, lastError, createdAt, updatedAt

### AiSandboxLog
- Fields: id, executionLogId, modelName, requestType, status, latencyMs, timeoutMs, retryCount, tokenCount, promptPreview, responsePreview, errorType, errorDetail, cost, createdAt

### AiTimeoutConfig
- Fields: id, taskType, timeoutMs, retryCount, retryDelayMs, createdAt, updatedAt

### ShadowConfig
- Fields: id, enabled, grayThreshold, maxConcurrent, rateLimitPerMin, costBudget, costSpent, autoRollback, lastRolledBack, updatedAt, executionLogs

### ShadowExecutionLog
- Fields: id, shadowConfigId, sandboxLogId, taskId, projectId, userId, taskType, modelName, promptPreview, mockOutput, realOutput, mockLatencyMs, realLatencyMs, mockCost, realCost, status, errorMessage, retryCount, executedAt, createdAt, diffResult, shadowConfig

### ShadowDiffResult
- Fields: id, executionLogId, taskType, modelName, structureMatch, structureScore, contentScore, latencyDelta, costDelta, driftScore, overallScore, judgedAt, createdAt, executionLog

### ShadowDriftHistory
- Fields: id, modelName, taskType, windowCount, avgDriftScore, avgStructureScore, avgContentScore, avgLatencyDelta, avgCostDelta, sampleStartAt, sampleEndAt, createdAt

### CostBudget
- Fields: id, scope, scopeId, budgetAmount, spentAmount, alertThreshold, blockThreshold, period, enabled, lastAlertAt, lastBlockedAt, createdAt, updatedAt

### SystemMetric
- Fields: id, timestamp, cpuPercent, memoryMb, eventLoopLag, queueLength, queuePressure, activeWorkers, workerEfficiency, workerCompleted, pidPressure, generatorRate, costPerMin, totalCost, ses, degraded, stabilityScore, stabilityGrade

### ReplayFrame
- Fields: id, timestamp, queueLength, queuePressure, activeWorkers, workerThroughput, workerEfficiency, pidPressure, generatorRate, ses, memoryMb, costPerMin, totalCost, queueGrowthRate, workerTrend, memorySlope, pidVariance, stabilityScore, stabilityGrade, label, sessionId, session

### StabilitySession
- Fields: id, label, status, startedAt, finishedAt, durationSec, queuePattern, workerDecayCurve, pidSignature, costProfile, recoveryProfile, grade, score, eventCount, worstEvent, phases, events, frames

### DegradationEvent
- Fields: id, sessionId, timestamp, elapsedSec, eventType, severity, message, metricValues, session

### PromptMemory
- Fields: id, userId, prompt, optimizedPrompt, provider, modelName, taskType, style, mode, qualityScore, consistencyScore, realismScore, renderTimeMs, cost, success, failureReason, feedback, createdAt, updatedAt

### ApiKey
- Fields: id, provider, keyName, keyValue, updatedAt

### UserModelConfigV2
- Fields: userId, imageProvider, videoProvider, ttsProvider, imageApiKey, videoApiKey, ttsApiKey, llmProvider, llmApiKey, llmModel, llmEnabled, baseUrl, llmBaseUrl, imageBaseUrl, videoBaseUrl, ttsBaseUrl, imageModel, imageEnabled, videoModel, videoEnabled, ttsModel, ttsEnabled, musicProvider, musicApiKey, musicModel, musicEnabled, musicBaseUrl, createdAt, updatedAt, user

### ModelProvider
- Fields: id, provider, label, modelType, modelName, apiKeyEnv, endpoint, aspectRatioMap, defaultParams, isActive, sortOrder, createdAt, updatedAt

### VoicePreset
- Fields: id, name, voiceId, type, description, targetModel, sampleUrl, isActive, createdAt, updatedAt

### DailyUsage
- Fields: id, userId, date, videoCount, imageCount, ttsCount, llmCount, updatedAt, user

### AdminUser
- Fields: id, username, passwordHash, displayName, role, enabled, createdAt, updatedAt

### AssetDna
- Fields: id, assetId, creatorId, projectId, type, promptStructure, styleVector, characterEmbedding, compositionVector, colorDistribution, modelInfo, workflowInfo, createdAt

### AssetLineage
- Fields: id, assetId, parentAssetIds, rootAssetId, lineageDepth, creatorChain, createdAt

### AssetReference
- Fields: id, sourceAssetId, targetAssetId, userId, projectId, referenceType, coinsPaid, createdAt

### ContributionWeight
- Fields: id, assetId, creatorId, contributionScore, inheritedWeight, role, createdAt

### RevenueSplit
- Fields: id, transactionId, creatorId, assetId, amount, percentage, role, createdAt

### AssetTransaction
- Fields: id, fromUserId, toUserId, assetId, projectId, transactionType, coinsAmount, platformFee, status, createdAt

### CreatorWallet
- Fields: id, userId, totalEarned, totalSpent, balance, referenceCount, reuseCount, updatedAt

### ModerationQueue
- Fields: id, assetId, reason, similarityScore, reportedBy, status, reviewerId, reviewedAt, createdAt

### PaymentConfig
- Fields: id, method, name, qrCodeUrl, account, enabled, sort, updatedAt, createdAt

### PaymentSecret
- Fields: id, channel, config, enabled, remark, updatedAt, createdAt

### PaymentOrder
- Fields: id, userId, orderNo, type, amount, coins, method, status, planType, prepayId, qrCode, payUrl, outTradeNo, rawNotify, remark, payTime, confirmAdminId, confirmTime, createdAt, updatedAt

### AgentDef
- Fields: id, name, type, role, model, systemPrompt, capabilities, memoryEnabled, costLevel, status, version, createdAt, updatedAt, edgesFrom, edgesTo, executions, memories, entryWorkflow

### AgentEdge
- Fields: id, fromAgentId, toAgentId, condition, priority, executionMode, createdAt, fromAgent, toAgent

### WorkflowDef
- Fields: id, name, entryAgentId, graphJson, version, isDefault, createdAt, entryAgent

### AgentExecution
- Fields: id, workflowId, runId, agentId, input, output, llmCalls, tokensUsed, cost, latency, status, createdAt, agent

### AgentMemory
- Fields: id, agentId, projectId, memoryType, content, embeddingVector, updatedAt, createdAt, agent

### AssetRights
- Fields: id, assetId, publicView, reuseAllowed, downloadAllowed, commercialAllowed, externalAsset, updatedAt

### UserLimit
- Fields: id, userId, llmLimitPerMin, gpuLimitPerDay, agentLimit, burstLimit

### TaskQueue
- Fields: id, userId, type, priority, status, payload, enqueueTime, startTime, endTime, estimatedCost, retryCount, maxRetries, lockWorkerId, error

### TaskExecution
- Fields: id, taskId, workflowId, dagId, status, currentNode, progress, error, createdAt, updatedAt

### AgentExecutionLog
- Fields: id, executionId, agentId, input, output, latency, tokensUsed, cost, workerId, status, createdAt

### MarketAgent
- Fields: id, name, contactPerson, phone, email, level, commissionRate, settlementCycle, bankName, bankAccount, accountName, remark, referredUsers, totalCommission, settledCommission, pendingCommission, status, agentType, regionCode, regionName, createdAt, updatedAt, orderRecords

### CommissionConfig
- Fields: id, level, rate, minOrderAmount, maxCommission, enabled, updatedAt, createdAt

### CommissionOrder
- Fields: id, agentId, orderAmount, commissionRate, commissionAmount, status, remark, createdAt, settledAt, userId, orderId, agent

### AgentPlan
- Fields: id, level, name, price, months, commissionRate, benefits, icon, color, sortOrder, enabled, createdAt, updatedAt

### AgentWithdraw
- Fields: id, userId, amount, accountName, status, remark, createdAt, approvedAt, adminId, bankAccount, bankName

### DAGGraph
- Fields: id, workflowId, dagHash, optimizedGraph, parallelGroups, executionOrder, compiledAt, version

### DAGState
- Fields: id, dagId, executionId, status, activeNodes, completedNodes, failedNodes, currentLoad, updatedAt, createdAt

### GPUNode
- Fields: id, name, type, status, maxCapacity, currentLoad, queueDepth, temperature, lastHeartbeat

### GPUTaskLog
- Fields: id, taskId, model, priority, status, assignedGpu, userId, prompt, enqueueTime, startTime, endTime, estimatedSeconds, retryCount, error

### GPUThrottleState
- Fields: id, gpuId, loadPercent, throttleLevel, mode, updatedAt

### SystemMonitor
- Fields: id, cpuUsage, gpuUsage, memoryUsage, queueDepth, llmRequestsPerSec, errorRate, timestamp

### RateLimit
- Fields: id, userId, apiType, limitPerSec, limitPerMin, limitPerDay, currentUsage, windowStart

### CircuitBreaker
- Fields: id, service, status, failureCount, successCount, threshold, lastFailureTime, lastSuccessTime, cooldownTime, updatedAt

### WorkerHeartbeat
- Fields: id, workerId, type, status, currentTasks, heartbeatAt, lastActiveAt

### DesktopRuntimeConfig
- Fields: id, platform, runtimeMode, gpuPreference, autoDetect, createdAt, updatedAt

### LocalGPUNode
- Fields: id, adapterName, platform, memoryMB, computeUnits, driverVersion, temperature, usagePercent, isAvailable, lastSeen, createdAt

### LicenseCache
- Fields: id, userId, licenseToken, isActive, expiresAt, cachedAt, lastVerified

### LocalAssetIndex
- Fields: id, category, name, localPath, sizeBytes, checksum, syncedFromCloud, lastUsed, createdAt

### KernelEvent
- Fields: id, eventType, priority, source, payload, chainDepth, traceId, isLoopBreaker, createdAt

### KernelStateSnapshot
- Fields: id, snapshot, diff, recordedBy, checksum, createdAt

### RuntimeRegistry
- Fields: id, moduleId, name, dependencies, phase, priority, isActive, registeredAt, updatedAt

### KernelHealthLog
- Fields: id, moduleId, status, score, metrics, recommendations, createdAt

### SchedulerTask
- Fields: id, taskType, priority, moduleId, status, retries, maxRetries, timeout, submittedAt, startedAt, completedAt, errorMessage

### ResourceAllocation
- Fields: id, resourceType, resourceId, sessionId, allocatedTo, amount, unit, isActive, allocatedAt, releasedAt

### EventLoopViolation
- Fields: id, eventChain, triggerEvent, depth, breachedRule, actionTaken, createdAt

### RuntimeDependencyGraph
- Fields: id, graphId, version, nodes, edges, cycleDetected, cyclePaths, createdAt

### KernelShadowEventLog
- Fields: id, eventType, source, mirroredAt, consistency, originalEvent, shadowEvent, isMatch, createdAt

### KernelCutoverScore
- Fields: id, overallScore, eventConsistency, stateConsistency, schedulerStability, gpuCorrectness, latencyImpact, decision, phase, createdAt

### KernelDualExecutionLog
- Fields: id, taskId, taskType, oldLatency, kernelLatency, matchRate, oldResult, kernelResult, diff, passed, createdAt

### KernelStateDiffLog
- Fields: id, statePath, oldValue, kernelValue, diff, isConsistent, severity, createdAt

### KernelRollbackHistory
- Fields: id, reason, triggerSource, phase, snapshotId, errorRate, duration, success, createdAt

### KernelHealthMetrics
- Fields: id, eventLatency, schedulerDelay, gpuUtilization, workerLoad, stateSyncDelay, errorRate, memoryUsage, healthScore, recordedAt

### GenerationReference
- Fields: id, userId, taskId, assetUrl, assetId, refType, weight, priority, createdAt

### ProductionRecord
- Fields: id, userId, projectId, title, prompt, resultType, resultUrl, thumbnail, referenceMode, directorParams, version, createdAt

### World
- Fields: id, name, state

### Observer
- Fields: id, userId, worldId, role, influenceWeight, stats

### Event
- Fields: id, worldId, type, tick, data

### NarrativeScene
- Fields: id, worldId, summary, importance, tickRange, data

### Character
- Fields: id, worldId, name, age, faction, location, activity, alive, personality

### CharacterMemory
- Fields: id, characterId, type, content, importance, tick, emotionalTag, createdAt, character

### CharacterRelation
- Fields: id, fromId, toId, type, value, createdAt, updatedAt, from, to

### CharacterBehavior
- Fields: id, characterId, action, targetId, context, tick, score, executed, createdAt, character

### PipelineStage
- Fields: id, projectId, stageKey, status, inputData, outputData, referenceUrls, runtimeVersion, blockedBy, blockReason, error, startedAt, completedAt, createdAt, updatedAt, project

### PipelineJob
- Fields: id, projectId, stageKey, jobType, status, payload, result, attempts, maxAttempts, priority, sortKey, error, lockedBy, lockedAt, startedAt, completedAt, createdAt, updatedAt, project

### CharacterImage
- Fields: id, projectId, characterName, variant, imageUrl, sortOrder, createdAt, project

### SceneImage
- Fields: id, projectId, sceneName, imageUrl, sortOrder, createdAt, project

### StoryboardImage
- Fields: id, projectId, segmentId, description, imageUrl, sortOrder, createdAt, project

### PropImage
- Fields: id, projectId, propName, category, description, imageUrl, imagePrompt, negativePrompt, referenceUrl, sortOrder, createdAt, project

### PropLibrary
- Fields: id, name, category, description, defaultPrompt, imageUrl, sortOrder, createdAt

### FrameImage
- Fields: id, projectId, segmentId, frameType, imageUrl, createdAt, project

### CharacterReference
- Fields: id, projectId, characterName, imageUrl, refType, createdAt, project

### SceneReference
- Fields: id, projectId, sceneName, imageUrl, refType, createdAt, project

### CustomerChatSession
- Fields: id, userId, status, createdAt, updatedAt, messages

### CustomerChatMessage
- Fields: id, sessionId, role, content, createdAt, session

### CustomerChatMemory
- Fields: id, userId, key, value, createdAt, updatedAt

### Job
- Fields: id, projectId, type, status, stage, progress, payload, result, trace, error, createdAt, updatedAt

### UsageLog
- Fields: id, userId, projectId, taskId, cost, taskType, provider, tokens, isPlatform, createdAt

### WorldMemory
- Fields: id, projectId, entityType, entityId, name, memory, tags, episodeRef, createdAt, updatedAt

### StoryConstitution
- Fields: id, projectId, schemaVersion, constitutionVersion, constitutionHash, constitution, immutable, degraded, degradeReason, confidence, createdAt

### DirectorMemory
- Fields: id, projectId, continuityState, emotionalHistory, visualAnchors, characterLocks, updatedAt, createdAt

### JobQueue
- Fields: id, jobId, type, status, priority, lockedBy, lockedAt, projectId, createdAt, updatedAt

### AssetRegistry
- Fields: id, projectId, type, sourceId, status, currentVersion, sortOrder, createdAt, updatedAt, project, versions

### AssetVersion
- Fields: id, assetRegistryId, version, optimizationType, agent, diffSummary, content, prompt, userEdited, parentVersion, locked, referenceImages, createdAt, asset

### ContinuityLink
- Fields: id, projectId, fromSegmentId, fromType, toSegmentId, toType, linkType, inheritedContent, sortOrder, createdAt, project

### InvocationLog
- Fields: id, userId, projectId, traceId, executionId, stageId, capability, provider, model, status, latencyMs, tokenUsage, errorMsg, fallbackChain, sourcePath, runtimeVersion, agentType, operationType, assetRegistryId, createdAt

### AssetGraphEdge
- Fields: id, projectId, fromAssetId, fromType, toAssetId, toType, relationType, metadata, createdAt, project

### Organization
- Fields: id, name, createdAt, updatedAt, members, workspaces

### OrgMember
- Fields: id, organizationId, userId, role, createdAt, organization

### Workspace
- Fields: id, organizationId, name, tenantId, workspaceType, createdAt, updatedAt, projects, organization

### CommunityCategory
- Fields: id, name, slug, description, icon, sortOrder, postCount, isActive, createdAt, updatedAt

### CommunitySensitiveWord
- Fields: id, word, replaceWith, createdAt, updatedAt

### CommunityPost
- Fields: id, userId, title, content, mediaJson, tags, category, status, rejectReason, viewCount, likeCount, commentCount, rewardCoins, isPinned, isEssence, reviewedBy, reviewedAt, createdAt, updatedAt, comments, likes, user, rewards

### CommunityComment
- Fields: id, postId, userId, parentId, content, likeCount, createdAt, updatedAt, likes, parent, replies, post, user

### CommunityLike
- Fields: id, postId, userId, createdAt, post, user

### CommunityCommentLike
- Fields: id, commentId, userId, createdAt, comment, user

### CommunityReward
- Fields: id, postId, userId, coins, remark, createdAt, post, user

### StorageConfig
- Fields: id, name, type, endpoint, region, accessKey, secretKey, bucket, isDefault, enabled, remark, createdAt, updatedAt

### ProviderState
- Fields: id, userId, provider, status, lastError, errorCode, lastSuccessAt, lastFailAt, failureCount, circuitOpenedAt, keyFingerprint, enabled, createdAt, updatedAt

### LlmExecutionTrace
- Fields: id, traceId, userId, provider, model, success, latencyMs, decisionPath, sourcePath, error, timestamp

### UserMessage
- Fields: id, fromId, toId, content, media, read, createdAt, fromUser, toUser

### AnalyticsEvent
- Fields: id, userId, event, metadata, createdAt

### NarrativeV3Metrics
- Fields: id, scriptId, userId, fillCameraShot, fillCameraMovement, fillCameraAngle, fillCameraLens, fillEnvLocation, fillEnvLighting, fillEnvAtmosphere, fillEnvColorPalette, fillEmotionType, fillEmotionIntensity, fillCharacterPresence, fillAction, fillDialogue, qualityCameraAngle, qualityEmotionIntensity, qualityColorPalette, semanticYield, segmentCount, rawStats, createdAt

### RouteConfig
- Fields: id, scope, key, value, label, sortOrder, isActive, createdAt, updatedAt

### ScriptBreakdown
- Fields: id, projectId, title, script, targetDuration, segmentDuration, fixedSystemPrompt, status, resultScript, userId, characters, scenes, dialogues, actions, videoSegments, voices, meta, createdAt, updatedAt

### P18Pair
- Fields: pairId, projectId, userId, scriptContent, v2TaskId, v3TaskId, status, error, v3FillRate, v3QualityRate, v3SemanticYield, v3FallbackRate, v3MissingFieldRate, v3PromptFailureRate, v3PerceptualScores, createdAt, completedAt, V3RenderResult

### V3RenderResult
- Fields: taskId, pairId, userId, success, spec, prompt, traceId, error, stage, code, shotCount, factGrid, createdAt, completedAt

### public_V3RenderResult
- Fields: taskId, pairId, userId, success, spec, prompt, traceId, error, stage, code, shotCount, factGrid, createdAt, completedAt, P18Pair

### p18_pairs
- Fields: pairId, projectId, userId, scriptContent, v2TaskId, v3TaskId, status, error, v3FillRate, v3QualityRate, v3SemanticYield, v3FallbackRate, v3MissingFieldRate, v3PromptFailureRate, v3PerceptualScores, createdAt, completedAt

### HdzProject
- Fields: id, userId, title, genre, wordTarget, chapterWordTarget, styleDesc, status, locks

### HdzSession
- Fields: id, projectId, userId, status, messages

### HdzChapter
- Fields: id, projectId, chapterNo, title, status, outline, content, wordCount, summary, reviewNotes

### HdzCharacter
- Fields: id, projectId, name, role, properties

### HdzFaction
- Fields: id, projectId, name, type, description, leaderIds, memberIds, properties

### HdzMemory
- Fields: id, projectId, type, content, version, createdAt, updatedAt, project

### HdzStyleDna
- Fields: id, projectId, sourceText, fingerprint

### HdzAgentTask
- Fields: id, projectId, sessionId, agentType, status, input

### HdzManuscript
- Fields: id, projectId, title, content

### HdzOutline
- Fields: id, projectId, title, content

### HdzPublishLog
- Fields: id, projectId, target, status, result, createdAt, project

### EntityRegistry
- Fields: id, projectId, entityType, name, aliases, createdAt, project

### EventLog
- Fields: id, entityType, entityId, eventType, payload

### SceneDag
- Fields: id, projectId, sceneId, chapterNo, sceneNo, dagJson

### WorldState
- Fields: id, projectId, entityId, stateJson

### WriterAlignmentMetric
- Fields: id, projectId, chapterId, scoreJson

### PlotDagEdge
- Fields: id, projectId, sourceId, targetId, edgeType, metadata

### PromptVariant
- Fields: id, name, version, label, description, parentVersion, content

### GeoProjectProfile
- Fields: id, projectId, website, domain, brand, language, country, industry, topic, geoConfig

### GEOBrand
- Fields: id, slug, name, primaryDomain, additionalDomains, description, industry, region, companyType, primaryLanguage, targetMarkets, competitors, goals, aiTargets, status, version, createdAt, updatedAt, knowledgeSources, projects

### GEOKnowledgeSource
- Fields: id, brandId, type, url, label, crawlStrategy, status, lastScanned, createdAt, updatedAt, brand

### GEOProject
- Fields: id, userId, brandId, name, website, topic, industry, keywords, language, country, status, config

### GEODiscoveryReport
- Fields: id, projectId, entityName, adi, coverageScore, shareScore, positionScore, reportData, createdAt, updatedAt, project

### GEOActionPlan
- Fields: id, projectId, discoveryReportId, planData, status, createdAt, updatedAt, project

### GEOVerificationReport
- Fields: id, projectId, entityName, beforeAdi, afterAdi, deltaAdi, reportData, createdAt, project

### GEOScanRecord
- Fields: id, projectId, userId, scanStatus, scanStartedAt, scanFinishedAt, visibilityScore, accuracyScore, consistencyScore, recommendationScore, overallScore, aiResponses, optimizationItems, errorMessage, durationMs, createdAt, updatedAt, project

### GEOEntity
- Fields: id, projectId, tenantId, name, type, description, metadata

### GEOEntityRelation
- Fields: id, projectId, sourceId, tenantId, targetId, type, lineage

### GEOProjectVersion
- Fields: id, projectId, tenantId, version, label, graphData

### GEOClaim
- Fields: id, entityId, tenantId, text, claimType, confidence, sourceType, status, provenance

### GEOEvidence
- Fields: id, claimId, tenantId, source, content, credibilityScore, verificationMethod, collectedAt, provenance

### GEOCitation
- Fields: id, evidenceId, format, tenantId, citationText, sourceUrl, publisher, author, datePublished, authorityLevel, provenance

### GEOFAQ
- Fields: id, entityId, tenantId, question, answer, schemaType, confidence, status, provenance

### GEOSchemaMarkup
- Fields: id, tenantId, entityId, schemaType, markup

### GEOReviewQueue
- Fields: id, projectId, tenantId, reviewableType, reviewableId, state, reviewerId, reviewNotes, previousState, provenance

### GEOQualityScore
- Fields: id, projectId, tenantId, dimension, score, breakdown

### GEOFreshnessRecord
- Fields: id, tenantId, projectId, objectType, objectId, freshnessState, verificationState, lastChecked, lastVerifiedAt, nextReviewAt, ttlSeconds, checkCount, metadata

### GEOBenchmarkRecord
- Fields: id, projectId, modelName, tenantId, pipeline, score, breakdown

### GEOScoreSnapshot
- Fields: id, projectId, tenantId, snapshot

### GEOOptimizationHistory
- Fields: id, projectId, tenantId, targetType, targetId, action, reason, beforeScore, afterScore, diagnostics

### GeoProject
- Fields: id, userId, name, website, industry, language, country, status, brandProfile, websiteSnapshot, knowledgeGraph, createdAt, updatedAt, schemaVersion

### GeoBrandProfile
- Fields: id, projectId, project, brandName, website, company, industry, primaryProducts, coreServices, targetAudience, targetRegions, primaryLanguage, competitors, keywords, brandDesc, socialLinks, createdAt, updatedAt, schemaVersion

### WebsiteSnapshot
- Fields: id, projectId, project, url, title, description, language, robots, sitemap, meta, openGraph, schema, jsonLd, pages, images, scripts, styles, headers, status, error, createdAt, updatedAt, scanVersion

### GeoGraphNode
- Fields: id, projectId, project, type, label, properties, outgoing, incoming, createdAt, updatedAt, schemaVersion

### GeoGraphEdge
- Fields: id, sourceId, targetId, type, properties, source, target, createdAt, schemaVersion

### UnifiedAsset
- Fields: id, projectId, type, title, language, source, sourceUrl, content, summary, metadata, hash, status, schemaVersion, createdAt, updatedAt, deletedAt, versions, tags, relationsFrom, relationsTo

### UnifiedAssetVersion
- Fields: id, assetId, version, content, hash, createdAt, asset

### UnifiedAssetTag
- Fields: id, assetId, tag, asset

### UnifiedAssetRelation
- Fields: id, fromAssetId, toAssetId, relation, fromAsset, toAsset

### RawDocument
- Fields: id, projectId, url, mime, headers, html, markdown, text, status, fetchedAt, createdAt

### SemanticEntity
- Fields: id, projectId, assetId, type, name, description, confidence, metadata, schemaVersion, createdAt, updatedAt, deletedAt, aliases, topics, sourceKeywords

### SemanticTopic
- Fields: id, projectId, name, description, confidence, metadata, schemaVersion, createdAt, updatedAt, entities

### SemanticEntityTopic
- Fields: entityId, topicId, entity, topic

### SemanticRelation
- Fields: id, projectId, fromEntityId, fromTopicId, toEntityId, toTopicId, relation, confidence, metadata, schemaVersion, createdAt

### SemanticAlias
- Fields: id, entityId, alias, language, confidence, entity

### SemanticTaxonomy
- Fields: id, projectId, name, parentId, description, path, depth, metadata, schemaVersion, createdAt, updatedAt, parent, children

### SemanticKeyword
- Fields: id, projectId, keyword, entityId, language, confidence, metadata, schemaVersion, createdAt, entity

### Goal
- Fields: id, projectId, title, description, successCriteria, targetMetric, deadline, priority, status, metadata, schemaVersion, createdAt, updatedAt, strategies, tasks

### Strategy
- Fields: id, goalId, name, description, type, status, priority, metadata, schemaVersion, createdAt, updatedAt, goal, workflows, tasks

### Workflow
- Fields: id, strategyId, name, description, status, metadata, schemaVersion, createdAt, updatedAt, strategy, stages, tasks

### WorkflowStage
- Fields: id, workflowId, name, order, status, metadata, schemaVersion, createdAt, workflow, tasks

### Task
- Fields: id, goalId, strategyId, workflowId, stageId, title, description, actionType, priority, dependencies, retryCount, maxRetries, deadline, status, metadata, schemaVersion, createdAt, updatedAt, goal, strategy, workflow, stage, executions

### Action
- Fields: id, name, description, provider, config, schemaVersion, createdAt, updatedAt

### Execution
- Fields: id, taskId, actionType, status, input, output, error, durationMs, retryAttempt, metadata, schemaVersion, createdAt, updatedAt, task, results, reviews

### ExecutionResult
- Fields: id, executionId, assetId, type, summary, details, schemaVersion, createdAt, execution

### Review
- Fields: id, executionId, status, comments, score, metadata, schemaVersion, createdAt, updatedAt, execution

### CapabilityContract
- Fields: id, name, displayName, description, category, version, inputSchema, outputSchema, constraints, qualityProfile, permissionProfile, tags, status, metadata, schemaVersion, createdAt, updatedAt, providerMappings

### CapabilityProviderMapping
- Fields: id, capabilityId, provider, priority, config, status, createdAt, updatedAt, capability

### ResourceContract
- Fields: id, name, type, vendor, description, capabilities, models, endpoints, authentication, pricing, limits, metadata, schemaVersion, status, createdAt, updatedAt, credentials, healthRecords, capabilityMatrix, costRecords

### ResourceCredential
- Fields: id, resourceId, tenantId, workspaceId, name, encryptedKey, endpoint, models, status, rotationPolicy, lastRotated, expiresAt, metadata, schemaVersion, createdAt, updatedAt, resource, usageRecords

### ResourceHealth
- Fields: id, resourceId, credentialId, status, latencyMs, errorRate, rateLimitRemaining, quotaRemaining, lastSuccessAt, lastFailureAt, failureReason, metadata, checkedAt, resource

### ResourceCapabilityMatrix
- Fields: id, resourceId, capabilityId, supported, qualityScore, costMultiplier, metadata, createdAt, updatedAt, resource

### ResourceUsage
- Fields: id, credentialId, tenantId, workspaceId, resourceType, model, promptTokens, completionTokens, totalTokens, latencyMs, estimatedCost, actualCost, currency, status, executionId, metadata, createdAt, credential

### ResourceCost
- Fields: id, resourceId, tenantId, workspaceId, billingPeriod, totalCost, currency, metadata, periodStart, periodEnd, createdAt, updatedAt, resource

### WorkspaceRuntime
- Fields: id, type, tenantId, name, description, status, runtimeState, manifest, settings, metadata, schemaVersion, createdAt, updatedAt, activatedAt, archivedAt, snapshots, versions, drafts, operations, assets, conversations, checkpoints, executions

### WorkspaceSnapshot
- Fields: id, workspaceId, version, label, runtimeState, assetState, graphState, variables, metadata, createdAt, autoSave, runtime

### WorkspaceVersion
- Fields: id, workspaceId, version, label, description, snapshotId, published, parentVersion, metadata, createdAt, runtime

### WorkspaceDraft
- Fields: id, workspaceId, draftNumber, contentState, runtimeState, autoSave, createdAt, runtime

### WorkspaceOperation
- Fields: id, workspaceId, type, target, targetId, description, diff, reverseDiff, userId, metadata, createdAt, runtime

### WorkspaceAsset
- Fields: id, workspaceId, type, path, mimeType, size, hash, metadata, createdAt, runtime

### WorkspaceConversation
- Fields: id, workspaceId, sessionId, role, content, context, summary, tokenCount, metadata, createdAt, runtime

### WorkspaceCheckpoint
- Fields: id, workspaceId, name, description, snapshotId, versionId, metadata, createdAt, runtime

### WorkspaceExecution
- Fields: id, workspaceId, executionId, planVersion, status, result, runtimeState, metadata, createdAt, completedAt, runtime

### AgentDefinition
- Fields: id, code, name, version, description, capabilities, supportedResources, inputSchema, outputSchema, executionMode, permissions, category, status, metadata, schemaVersion, createdAt, updatedAt, sessions, queues, agentPerms

### AgentSession
- Fields: id, workspaceId, agentId, sessionType, status, input, output, runtimeState, error, startedAt, finishedAt, executedBy, metadata, createdAt, updatedAt, agent, stepExecutions, events, artifactOutputs

### AgentStepExecution
- Fields: id, sessionId, stepName, planId, executionId, capability, status, input, output, cost, tokenCount, latencyMs, error, startedAt, completedAt, metadata, createdAt, session

### AgentEvent
- Fields: id, sessionId, type, data, timestamp, session

### AgentContextMemory
- Fields: id, sessionId, type, content, relevanceScore, ttl, metadata, createdAt, expiresAt

### AgentQueue
- Fields: id, agentId, workspaceId, priority, status, input, scheduledAt, startedAt, completedAt, metadata, createdAt, agent

### AgentPermission
- Fields: id, agentId, resource, action, scope, metadata, createdAt, agent

### AgentArtifact
- Fields: id, sessionId, name, type, content, mimeType, size, hash, metadata, createdAt, session

### WorkflowDefinition
- Fields: id, code, name, version, description, trigger, graph, variables, permissions, status, category, metadata, schemaVersion, createdAt, updatedAt, instances, templates

### WorkflowInstance
- Fields: id, workflowId, workspaceId, status, currentNode, input, output, result, cost, error, startedAt, finishedAt, metadata, createdAt, updatedAt, workflow, nodes, edges, checkpoints, executions, variables, events

### WorkflowNode
- Fields: id, instanceId, nodeId, type, name, config, status, input, output, error, startedAt, completedAt, retryCount, metadata, createdAt, instance

### WorkflowEdge
- Fields: id, instanceId, edgeId, sourceNodeId, targetNodeId, condition, label, metadata, createdAt, instance

### WorkflowCheckpoint
- Fields: id, instanceId, nodeId, snapshot, variables, metadata, createdAt, instance

### WorkflowExecution
- Fields: id, instanceId, nodeId, executionType, executionId, status, input, output, cost, latencyMs, error, startedAt, completedAt, metadata, createdAt, instance

### WorkflowVariable
- Fields: id, instanceId, scope, name, value, nodeId, metadata, createdAt, updatedAt, instance

### WorkflowEvent
- Fields: id, instanceId, type, nodeId, data, timestamp, instance

### WorkflowTemplate
- Fields: id, workflowId, code, name, description, category, template, defaultVariables, metadata, createdAt, workflow

### Tenant
- Fields: id, name, type, status, metadata, schemaVersion, createdAt, updatedAt, organizations, subscriptions, quota, usageRecords, billingRecords, auditLogs, roles, users, policies, licenses, analyticsDaily, projects

### GovOrganization
- Fields: id, tenantId, name, type, parentId, status, metadata, createdAt, updatedAt, tenant, parent, children

### GovUser
- Fields: id, tenantId, email, name, role, status, metadata, createdAt, updatedAt, tenant

### Role
- Fields: id, tenantId, code, name, description, capabilities, metadata, createdAt, updatedAt, tenant

### SubscriptionPlan
- Fields: id, code, name, description, price, currency, billingCycle, capabilities, metadata, schemaVersion, status, createdAt, updatedAt, subscriptions, grants

### Subscription
- Fields: id, tenantId, planId, status, startDate, endDate, autoRenew, metadata, createdAt, updatedAt, tenant, plan

### CapabilityGrant
- Fields: id, planId, capability, limits, metadata, createdAt, plan

### Quota
- Fields: id, tenantId, dailyTokens, monthlyTokens, imageCredits, videoMinutes, speechMinutes, concurrentJobs, workflowRuns, agentSessions, storage, workspaceCount, metadata, createdAt, updatedAt, tenant

### UsageRecord
- Fields: id, tenantId, resourceType, amount, unit, capability, source, sourceId, metadata, recordedAt, tenant

### BillingRecord
- Fields: id, tenantId, type, amount, currency, description, source, metadata, createdAt, tenant

### AuditLog
- Fields: id, tenantId, userId, action, resource, resourceId, details, ipAddress, userAgent, metadata, createdAt, tenant

### Policy
- Fields: id, tenantId, code, name, type, rules, enabled, priority, metadata, createdAt, updatedAt, tenant

### License
- Fields: id, tenantId, licenseKey, status, seats, modules, startDate, endDate, metadata, createdAt, updatedAt, tenant

### AnalyticsDaily
- Fields: id, tenantId, date, metric, value, metadata, createdAt, tenant

### DualWriteWatcherEvent
- Fields: id, entity, entityId, operation, status, latencyMs, error, flags, diff, createdAt

### LLMUsageRecord
- Fields: id, userId, projectId, agent, provider, model, promptTokens, completionTokens, totalTokens, latencyMs, status, error, cost, promptKey, promptVersion, traceId, workflowId, executionId, createdAt

### KnowledgeObject
- Fields: id, projectId, workflowId, topic, status, confidence, qualityScore, provenance, metadata, entities, relations, claims, evidence, citations, createdAt, updatedAt

### GeoKeyword
- Fields: id, projectId, keyword, type, source, createdAt, updatedAt

### GeoBrandSetting
- Fields: id, projectId, brandName, website, industry, region, language, description, logo, status, createdAt, updatedAt

### GeoScanHistory
- Fields: id, projectId, scanType, status, topic, knowledgeObjectId, result, error, startedAt, completedAt, createdAt

### OptimizationExecution
- Fields: id, projectId, optimizationType, executionStatus, triggerSource, beforeSnapshotId, afterSnapshotId, verificationVersion, geoScoreVersion, verificationStatus, beforeScore, afterScore, scoreDelta, changedDimensions, beforeDimensions, afterDimensions, industry, brandType, startedAt, completedAt, verifiedAt

### VerificationJob
- Fields: id, executionId, status, retryCount, maxRetries, lockedBy, lockedAt, lastError, createdAt, startedAt, completedAt

### VerificationResult
- Fields: id, projectId, executionId, isImprovement, deltaWhenVerified, verifiedAt, rawEvidence, details

### VerificationPolicy
- Fields: id, industry, optimizationType, minimumDelta, noiseThreshold, minimumConfidence, requireRevalidation, maxRetries, priority, isActive, createdAt

### GrowthMemory
- Fields: id, industry, brandType, optimizationType, totalExecutions, successfulCount, failedCount, noChangeCount, totalDelta, averageDelta, successRate, sampleSize, confidence, aggregationVersion, lastUpdated

### LearningSignal
- Fields: id, source, signalType, originalValue, normalizedValue, weight, weightedValue, industry, optimizationType, reason, executionId, generatedAt

### GeoScoreVersion
- Fields: id, version, releaseNote, isActive, dimensionWeights, createdAt, activatedAt

### GrowthKnowledge
- Fields: id, industry, brandType, optimizationType, insight, bestPractice, commonFailure, source, sampleSize, averageDelta, createdAt, updatedAt

### PublishableClaim
- Fields: id, projectId, verificationId, sourceActionId, title, contentType, content, status, version, createdAt, updatedAt, plans, records

### PublishPlan
- Fields: id, projectId, title, status, targetChannels, executionOrder, createdAt, updatedAt, publishedAt, claims, records

### PublishPlanToClaim
- Fields: planId, claimId, plan, claim

### PublishingRecord
- Fields: id, planId, claimId, channel, version, artifactHash, artifactUrl, status, publishedAt, createdAt, plan, claim

### KnowledgeAsset
- Fields: id, claimId, recordId, assetType, status, title, humanContent, searchContent, aiContent, version, createdAt, updatedAt

### AssetVariant
- Fields: id, assetId, variantType, contentType, content, version, artifactHash, createdAt, updatedAt

### DistributionTarget
- Fields: id, targetType, displayName, description, enabled, configSchema, createdAt, updatedAt

### DistributionPlan
- Fields: id, projectId, title, status, strategy

### DistributionPlanToAsset
- Fields: planId, assetId

### DistributionAttempt
- Fields: id, planId, adapterId, assetIds, attemptNo, status, outputUrl, artifactHash, durationMs, errorLog, startedAt, finishedAt, createdAt

### DistributionAdapter
- Fields: id, adapterType, name, adapterClass, enabled, config

### KnowledgePackage
- Fields: id, assetId, projectId, packageType, status, version, artifactHash, createdAt, updatedAt, manifestId, artifacts

### PackageManifest
- Fields: id, schemaVersion, sourceAssetId, sourceClaimId, sourceRecordId, sourceProjectId, title, summary, estimatedSize, mimeType, language, preferredTargets, cacheTTL, requiresIndexing, priority, contentHash, signed, timestamp

### PackageArtifact
- Fields: id, packageId, fileName, filePath, mimeType, content, contentHash, size, sortOrder, createdAt, package

### DeliveryJob
- Fields: id, projectId, packageIds, targetId, status, priority, retryCount, maxRetries, createdAt, startedAt, completedAt, errorLog

### DeliveryTarget
- Fields: id, type, name, config

### DeliveryRecord
- Fields: id, jobId, packageId, targetId, status, outputPath, bytes, artifactCount, checksum, previousState, durationMs, errorLog, startedAt, finishedAt

### WalkthroughProgress
- Fields: id, userId, currentStep, dismissed, completed, lastSeenAt, updatedAt, createdAt

### ChinaRegion
- Fields: code, name, level, parentCode

### KnowledgeBrand
- Fields: id, name, industry, description, website, mission, vision, values, createdAt, updatedAt, products

### KnowledgeProduct
- Fields: id, brandId, name, description, features, pricing, useCases, createdAt, updatedAt, brand

### KnowledgeArticle
- Fields: id, type, title, content, category, tags, status, version, createdAt, updatedAt

### KnowledgeCategory
- Fields: id, name, slug, description, parentId, articleCount, parent, children

### KnowledgeEntity
- Fields: id, type, name, aliases, description, relations, knowledgeSignals, createdAt, updatedAt

### KnowledgePublication
- Fields: id, type, status, target, content, publishedAt, createdAt

### PublishManifest
- Fields: id, slug, type, name, status, version, manifest, publishedAt, archivedAt, updatedAt, createdAt, sourceId, sourceType

## Detailed Findings


### [WARNING] src/core/asset-economy/creator-wallet/wallet-manager.ts:147
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/core/asset-economy/moderation/review-queue.ts:73
- **Model:** moderationQueue
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "moderationQueue"

---

### [WARNING] src/core/asset-economy/transaction-engine/transaction-logger.ts:98
- **Model:** assetTransaction
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "assetTransaction"

---

### [WARNING] src/core/citation/CitationRepository.ts:141
- **Model:** gEOCitation
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOCitation"

---

### [WARNING] src/director-v2/memory/constitution-store.ts:71
- **Model:** storyConstitution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "storyConstitution"

---

### [WARNING] src/director-v2/memory/constitution-store.ts:101
- **Model:** storyConstitution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "storyConstitution"

---

### [WARNING] src/director-v2/memory/constitution-store.ts:124
- **Model:** storyConstitution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "storyConstitution"

---

### [WARNING] src/gateway/routes.ts:263
- **Model:** usageLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "usageLog"

---

### [WARNING] src/jobs/job-store.ts:121
- **Model:** job
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "job"

---

### [WARNING] src/platform/knowledge-hub/attempt-scheduler.service.ts:76
- **Model:** distributionAttempt
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "distributionAttempt"

---

### [WARNING] src/platform/knowledge-hub/distribution-planner.service.ts:120
- **Model:** distributionPlan
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "distributionPlan"

---

### [WARNING] src/platform/knowledge-hub/repos/package.repository.ts:40
- **Model:** knowledgePackage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "knowledgePackage"

---

### [WARNING] src/platform/knowledge-hub/repos/package.repository.ts:48
- **Model:** knowledgePackage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "knowledgePackage"

---

### [WARNING] src/platform/knowledge-hub/repos/package.repository.ts:56
- **Model:** knowledgePackage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "knowledgePackage"

---

### [WARNING] src/platform/knowledge-hub/repository/package-repository.ts:41
- **Model:** knowledgePackage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "knowledgePackage"

---

### [WARNING] src/platform/knowledge-hub/repository/package-repository.ts:60
- **Model:** knowledgePackage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "knowledgePackage"

---

### [WARNING] src/routes/admin-agents.ts:19
- **Model:** agentDef
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "agentDef"

---

### [WARNING] src/routes/admin-auth.ts:163
- **Model:** project
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "project"

---

### [WARNING] src/routes/admin-auth.ts:172
- **Model:** user
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "user"

---

### [WARNING] src/routes/admin-customer-service.ts:91
- **Model:** customerChatSession
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "customerChatSession"

---

### [WARNING] src/routes/admin-customer-service.ts:98
- **Model:** UNKNOWN
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "unknown"

---

### [WARNING] src/routes/admin-customer-service.ts:124
- **Model:** customerChatSession
- **Field:** `createdAt`
- **Code:** `messages: { orderBy: { createdAt: 'asc' } },`
- **Message:** Cannot verify "createdAt" — model "customerChatSession"

---

### [WARNING] src/routes/admin-evaluation-samples.ts:141
- **Model:** evaluationSample
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "evaluationSample"

---

### [WARNING] src/routes/admin-market-agents.ts:32
- **Model:** marketAgent
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "marketAgent"

---

### [WARNING] src/routes/admin-market-agents.ts:46
- **Model:** marketAgent
- **Field:** `createdAt`
- **Code:** `orderRecords: { orderBy: { createdAt: 'desc' }, take: 50 },`
- **Message:** Cannot verify "createdAt" — model "marketAgent"

---

### [WARNING] src/routes/admin-market-agents.ts:73
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/admin-market-agents.ts:87
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/admin-market-agents.ts:236
- **Model:** commissionOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "commissionOrder"

---

### [WARNING] src/routes/admin-members-storage.ts:15
- **Model:** user
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "user"

---

### [WARNING] src/routes/admin-models-v2.ts:33
- **Model:** aiModel
- **Field:** `createdAt`
- **Code:** `const models = await prisma.aiModel.findMany({ orderBy: { createdAt: 'desc' } })`
- **Message:** Cannot verify "createdAt" — model "aiModel"

---

### [WARNING] src/routes/admin-novels.ts:39
- **Model:** hdzProject
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "hdzProject"

---

### [WARNING] src/routes/admin-posts.ts:36
- **Model:** communityPost
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "communityPost"

---

### [WARNING] src/routes/admin-storage-config.ts:33
- **Model:** storageConfig
- **Field:** `createdAt`
- **Code:** `const configs = await prisma.storageConfig.findMany({ orderBy: { createdAt: 'desc' } })`
- **Message:** Cannot verify "createdAt" — model "storageConfig"

---

### [WARNING] src/routes/admin-wallet.ts:20
- **Model:** agentWithdraw
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "agentWithdraw"

---

### [WARNING] src/routes/agent-plan.ts:246
- **Model:** commissionOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "commissionOrder"

---

### [WARNING] src/routes/agent-plan.ts:269
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/agent-plan.ts:315
- **Model:** agentWithdraw
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "agentWithdraw"

---

### [WARNING] src/routes/agent-plan.ts:327
- **Model:** agentWithdraw
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "agentWithdraw"

---

### [WARNING] src/routes/community/posts.ts:78
- **Model:** communityPost
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "communityPost"

---

### [WARNING] src/routes/community/posts.ts:84
- **Model:** communityPost
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "communityPost"

---

### [WARNING] src/routes/community/posts.ts:179
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/community/posts.ts:192
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/customer-service.ts:216
- **Model:** customerChatSession
- **Field:** `createdAt`
- **Code:** `include: { messages: { orderBy: { createdAt: 'desc' }, take: MAX_HISTORY } },`
- **Message:** Cannot verify "createdAt" — model "customerChatSession"

---

### [WARNING] src/routes/customer-service.ts:223
- **Model:** customerChatSession
- **Field:** `createdAt`
- **Code:** `include: { messages: { take: 0, orderBy: { createdAt: 'desc' } } },`
- **Message:** Cannot verify "createdAt" — model "customerChatSession"

---

### [WARNING] src/routes/customer-service.ts:235
- **Model:** customerChatMessage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "customerChatMessage"

---

### [WARNING] src/routes/customer-service.ts:244
- **Model:** customerChatMemory
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "customerChatMemory"

---

### [WARNING] src/routes/customer-service.ts:363
- **Model:** customerChatSession
- **Field:** `createdAt`
- **Code:** `include: { messages: { orderBy: { createdAt: 'asc' }, take: 5 } },`
- **Message:** Cannot verify "createdAt" — model "customerChatSession"

---

### [WARNING] src/routes/customer-service.ts:364
- **Model:** customerChatSession
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "customerChatSession"

---

### [WARNING] src/routes/execution-images/character-images.ts:38
- **Model:** project
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "project"

---

### [WARNING] src/routes/execution-images.ts:177
- **Model:** project
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "project"

---

### [WARNING] src/routes/execution-images.ts:711
- **Model:** storyboardImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "storyboardImage"

---

### [WARNING] src/routes/execution-images.ts:727
- **Model:** frameImage
- **Field:** `createdAt`
- **Code:** `prisma.frameImage.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),`
- **Message:** Cannot verify "createdAt" — model "frameImage"

---

### [WARNING] src/routes/execution-images.ts:778
- **Model:** frameImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' }`
- **Message:** Cannot verify "createdAt" — model "frameImage"

---

### [WARNING] src/routes/generate-scroll.ts:46
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/hdz/agent.ts:124
- **Model:** hdzAgentTask
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "hdzAgentTask"

---

### [WARNING] src/routes/hdz/agent.ts:166
- **Model:** hdzAgentTask
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "hdzAgentTask"

---

### [WARNING] src/routes/hdz/chat.ts:38
- **Model:** hdzSession
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "hdzSession"

---

### [WARNING] src/routes/hdz/faction.ts:50
- **Model:** hdzFaction
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "hdzFaction"

---

### [WARNING] src/routes/hdz/memory.ts:25
- **Model:** hdzMemory
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "hdzMemory"

---

### [WARNING] src/routes/hdz/memory.ts:48
- **Model:** hdzMemory
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "hdzMemory"

---

### [WARNING] src/routes/hdz/phasex.ts:183
- **Model:** plotDagEdge
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "plotDagEdge"

---

### [WARNING] src/routes/hdz/project.ts:17
- **Model:** hdzProject
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "hdzProject"

---

### [WARNING] src/routes/member.ts:75
- **Model:** coinLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "coinLog"

---

### [WARNING] src/routes/member.ts:156
- **Model:** userAsset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "userAsset"

---

### [WARNING] src/routes/member.ts:658
- **Model:** rechargeOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "rechargeOrder"

---

### [WARNING] src/routes/member.ts:900
- **Model:** user
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "user"

---

### [WARNING] src/routes/member.ts:1043
- **Model:** aiVideoSegment
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "aiVideoSegment"

---

### [WARNING] src/routes/messages.ts:39
- **Model:** userMessage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "userMessage"

---

### [WARNING] src/routes/messages.ts:85
- **Model:** userMessage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "userMessage"

---

### [WARNING] src/routes/messages.ts:143
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/payment.ts:472
- **Model:** paymentOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "paymentOrder"

---

### [WARNING] src/routes/payment.ts:484
- **Model:** rechargeOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "rechargeOrder"

---

### [WARNING] src/routes/payment.ts:525
- **Model:** paymentOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "paymentOrder"

---

### [WARNING] src/routes/pipeline.ts:33
- **Model:** pipelineStage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "pipelineStage"

---

### [WARNING] src/routes/projects.ts:255
- **Model:** asset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "asset"

---

### [WARNING] src/routes/qq-oauth.ts:411
- **Model:** smsCode
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "smsCode"

---

### [WARNING] src/routes/script-breakdown.ts:85
- **Model:** scriptBreakdown
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "scriptBreakdown"

---

### [WARNING] src/routes/script-breakdown.ts:199
- **Model:** project
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "project"

---

### [WARNING] src/routes/sms-auth.ts:132
- **Model:** smsCode
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "smsCode"

---

### [WARNING] src/routes/sms-auth.ts:193
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/routes/sms-auth.ts:300
- **Model:** smsCode
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "smsCode"

---

### [WARNING] src/routes/upload.ts:180
- **Model:** userAsset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "userAsset"

---

### [WARNING] src/routes/user-center.ts:19
- **Model:** coinLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "coinLog"

---

### [WARNING] src/routes/user-center.ts:111
- **Model:** userAsset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "userAsset"

---

### [WARNING] src/routes/user-center.ts:503
- **Model:** project
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "project"

---

### [WARNING] src/routes/user-center.ts:526
- **Model:** sceneImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "sceneImage"

---

### [WARNING] src/routes/user-center.ts:543
- **Model:** characterImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "characterImage"

---

### [WARNING] src/routes/user-center.ts:561
- **Model:** storyboardImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "storyboardImage"

---

### [WARNING] src/routes/user-center.ts:579
- **Model:** frameImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "frameImage"

---

### [WARNING] src/routes/user-center.ts:597
- **Model:** propImage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "propImage"

---

### [WARNING] src/routes/user-center.ts:614
- **Model:** userAsset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "userAsset"

---

### [WARNING] src/routes/voice.ts:108
- **Model:** voicePreset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "voicePreset"

---

### [WARNING] src/routes/wallet.ts:22
- **Model:** agentWithdraw
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "agentWithdraw"

---

### [WARNING] src/routes/wallet.ts:29
- **Model:** commissionOrder
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "commissionOrder"

---

### [WARNING] src/routes/workbench-project.ts:81
- **Model:** project
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "project"

---

### [WARNING] src/runtime/asset-state-audit.ts:53
- **Model:** invocationLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "invocationLog"

---

### [WARNING] src/runtime/prompt/PromptRuntimeLogger.ts:69
- **Model:** promptRuntimeLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "promptRuntimeLog"

---

### [WARNING] src/runtime/prompt/PromptTraceBuilder.ts:162
- **Model:** promptRuntimeLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "promptRuntimeLog"

---

### [WARNING] src/runtime/prompt/PromptVersionGraph.ts:73
- **Model:** promptVariant
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "promptVariant"

---

### [WARNING] src/services/ai-router.service.ts:433
- **Model:** aiExecutionLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "aiExecutionLog"

---

### [WARNING] src/services/asset/repositories/asset.repository.ts:68
- **Model:** unifiedAsset
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "unifiedAsset"

---

### [WARNING] src/services/asset/repositories/raw-document.repository.ts:28
- **Model:** rawDocument
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "rawDocument"

---

### [WARNING] src/services/geo/action-plan/engine.ts:46
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/decision-intelligence/issue-graph-builder.ts:223
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/explain/providers/discovery.provider.ts:32
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/explain/providers/recommendation.provider.ts:32
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/explain/providers/verification.provider.ts:29
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/growth/geo-monitor.service.ts:51
- **Model:** gEOScoreSnapshot
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOScoreSnapshot"

---

### [WARNING] src/services/geo/growth/normalizers/observation.normalizer.ts:18
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/geo/lifecycle/lifecycle-aggregator.service.ts:47
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/monitor/monitor-engine.ts:122
- **Model:** gEOScoreSnapshot
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOScoreSnapshot"

---

### [WARNING] src/services/geo/monitor/monitor-engine.ts:166
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/geo/monitor/monitor.service.ts:38
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/geo/monitor/monitor.service.ts:51
- **Model:** gEOScoreSnapshot
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOScoreSnapshot"

---

### [WARNING] src/services/geo/publishing/_deprecated/publishing-pipeline.service.ts:162
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/geo/publishing/claim.service.ts:36
- **Model:** publishableClaim
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishableClaim"

---

### [WARNING] src/services/geo/publishing/claim.service.ts:44
- **Model:** publishableClaim
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishableClaim"

---

### [WARNING] src/services/geo/publishing/manifest/manifest-repository.ts:62
- **Model:** publishManifest
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "publishManifest"

---

### [WARNING] src/services/geo/publishing/plan.service.ts:43
- **Model:** publishPlan
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishPlan"

---

### [WARNING] src/services/geo/publishing/recorder.service.ts:91
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/geo/publishing/recorder.service.ts:102
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/geo/recommendation/recommendation-timeline.service.ts:32
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/recommendation/recommendation-timeline.service.ts:114
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `geoBrandProfileRepository.findFirst({ projectId }, { orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/recommendation/recommendation-timeline.service.ts:115
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `geoEntityRepository.findFirst({ projectId }, { orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/recommendation/recommendation-timeline.service.ts:116
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `knowledgeObjectRepository.findFirst({ projectId }, { orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/repositories/GEOReportRepository.ts:121
- **Model:** gEODiscoveryReport
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEODiscoveryReport"

---

### [WARNING] src/services/geo/repositories/GEOReportRepository.ts:148
- **Model:** gEOActionPlan
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOActionPlan"

---

### [WARNING] src/services/geo/repositories/GEOReportRepository.ts:177
- **Model:** gEOVerificationReport
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOVerificationReport"

---

### [WARNING] src/services/geo/repositories/GEOReportRepository.ts:189
- **Model:** gEODiscoveryReport
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEODiscoveryReport"

---

### [WARNING] src/services/geo/repositories/GEOReportRepository.ts:194
- **Model:** gEOActionPlan
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOActionPlan"

---

### [WARNING] src/services/geo/repositories/GEOReportRepository.ts:199
- **Model:** gEOVerificationReport
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOVerificationReport"

---

### [WARNING] src/services/geo/repositories/geo-claim.repository.ts:77
- **Model:** gEOClaim
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "gEOClaim"

---

### [WARNING] src/services/geo/repositories/geo-project.repository.ts:90
- **Model:** gEOProject
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "gEOProject"

---

### [WARNING] src/services/geo/repositories/geo-quality.repository.ts:49
- **Model:** gEOQualityScore
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOQualityScore"

---

### [WARNING] src/services/geo/repositories/geo-quality.repository.ts:57
- **Model:** gEOQualityScore
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOQualityScore"

---

### [WARNING] src/services/geo/repositories/geo-review.repository.ts:59
- **Model:** gEOReviewQueue
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "gEOReviewQueue"

---

### [WARNING] src/services/geo/repositories/geo-review.repository.ts:67
- **Model:** gEOReviewQueue
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "gEOReviewQueue"

---

### [WARNING] src/services/geo/routes/geo-brand.route.ts:129
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/routes/geo-explain.route.ts:323
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/routes/geo-history.route.ts:65
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/routes/geo-optimization.route.ts:219
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/runtime/knowledge/KnowledgeObjectRepository.ts:34
- **Model:** knowledgeObject
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "knowledgeObject"

---

### [WARNING] src/services/geo/runtime/knowledge/KnowledgeObjectRepository.ts:42
- **Model:** knowledgeObject
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "knowledgeObject"

---

### [WARNING] src/services/geo/runtime/trace/ExecutionTraceService.ts:55
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/v1/geo-mvp.route.ts:83
- **Model:** gEOProject
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "gEOProject"

---

### [WARNING] src/services/geo/v1/geo-scan.service.ts:407
- **Model:** apiKey
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "apiKey"

---

### [WARNING] src/services/geo/v1/geo-scan.service.ts:465
- **Model:** gEOScanRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOScanRecord"

---

### [WARNING] src/services/geo/v1/geo-scan.service.ts:473
- **Model:** gEOScanRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "gEOScanRecord"

---

### [WARNING] src/services/geo/v1/geo-v1-product.route.ts:62
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/v1/geo-v1-product.route.ts:73
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/v1/geo-v1-product.route.ts:257
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/v1/geo-v1-product.route.ts:279
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/v1/geo-v1-product.route.ts:441
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/v1/geo-v1-product.route.ts:455
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/geo/verification/timeline.service.ts:66
- **Model:** publishingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "publishingRecord"

---

### [WARNING] src/services/goal/repositories/execution.repository.ts:74
- **Model:** execution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "execution"

---

### [WARNING] src/services/goal/repositories/execution.repository.ts:86
- **Model:** execution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "execution"

---

### [WARNING] src/services/goal/repositories/execution.repository.ts:136
- **Model:** executionResult
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "executionResult"

---

### [WARNING] src/services/goal/repositories/goal.repository.ts:65
- **Model:** goal
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "goal"

---

### [WARNING] src/services/goal/repositories/review.repository.ts:45
- **Model:** review
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "review"

---

### [WARNING] src/services/goal/repositories/review.repository.ts:55
- **Model:** review
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "review"

---

### [WARNING] src/services/goal/repositories/strategy.repository.ts:60
- **Model:** strategy
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "strategy"

---

### [WARNING] src/services/goal/repositories/strategy.repository.ts:70
- **Model:** strategy
- **Field:** `createdAt`
- **Code:** `const rows = await prisma.strategy.findMany({ where: { goalId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "strategy"

---

### [WARNING] src/services/goal/repositories/task.repository.ts:87
- **Model:** task
- **Field:** `createdAt`
- **Code:** `const rows = await prisma.task.findMany({ where: { goalId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "task"

---

### [WARNING] src/services/goal/repositories/task.repository.ts:92
- **Model:** task
- **Field:** `createdAt`
- **Code:** `const rows = await prisma.task.findMany({ where: { strategyId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "task"

---

### [WARNING] src/services/goal/repositories/task.repository.ts:97
- **Model:** task
- **Field:** `createdAt`
- **Code:** `const rows = await prisma.task.findMany({ where: { workflowId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "task"

---

### [WARNING] src/services/goal/repositories/task.repository.ts:102
- **Model:** task
- **Field:** `createdAt`
- **Code:** `const rows = await prisma.task.findMany({ where: { stageId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "task"

---

### [WARNING] src/services/goal/repositories/workflow.repository.ts:63
- **Model:** workflow
- **Field:** `createdAt`
- **Code:** `const rows = await prisma.workflow.findMany({ where: { strategyId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "workflow"

---

### [WARNING] src/services/hdz/alignment-metric.service.ts:244
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/hdz/director.service.ts:49
- **Model:** UNKNOWN
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "unknown"

---

### [WARNING] src/services/hdz/drift-analyzer.service.ts:81
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/hdz/drift-analyzer.service.ts:88
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/hdz/entity-registry.service.ts:147
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `const rows = await entityRegistryRepository.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }) as any[]`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/hdz/event-log.service.ts:63
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/hdz/planner.service.ts:34
- **Model:** hdzMemory
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "hdzMemory"

---

### [WARNING] src/services/hdz/writer.service.ts:189
- **Model:** hdzMemory
- **Field:** `updatedAt`
- **Code:** `const memories = await prisma.hdzMemory.findMany({ where: { projectId: ctx.projectId }, orderBy: { updatedAt: 'desc' } })`
- **Message:** Cannot verify "updatedAt" — model "hdzMemory"

---

### [WARNING] src/services/hdz/writer.service.ts:495
- **Model:** hdzMemory
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "hdzMemory"

---

### [WARNING] src/services/invocation-log.service.ts:71
- **Model:** invocationLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "invocationLog"

---

### [WARNING] src/services/invocation-log.service.ts:82
- **Model:** invocationLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "invocationLog"

---

### [WARNING] src/services/knowledge/repository/index.ts:11
- **Model:** knowledgeBrand
- **Field:** `createdAt`
- **Code:** `return prisma.knowledgeBrand.findMany({ orderBy: { createdAt: 'desc' } });`
- **Message:** Cannot verify "createdAt" — model "knowledgeBrand"

---

### [WARNING] src/services/knowledge/repository/index.ts:49
- **Model:** knowledgeProduct
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "knowledgeProduct"

---

### [WARNING] src/services/knowledge/repository/index.ts:85
- **Model:** knowledgeArticle
- **Field:** `createdAt`
- **Code:** `return prisma.knowledgeArticle.findMany({ orderBy: { createdAt: 'desc' } });`
- **Message:** Cannot verify "createdAt" — model "knowledgeArticle"

---

### [WARNING] src/services/knowledge/repository/index.ts:119
- **Model:** knowledgeEntity
- **Field:** `createdAt`
- **Code:** `return prisma.knowledgeEntity.findMany({ orderBy: { createdAt: 'desc' } });`
- **Message:** Cannot verify "createdAt" — model "knowledgeEntity"

---

### [WARNING] src/services/knowledge/repository/index.ts:154
- **Model:** knowledgePublication
- **Field:** `createdAt`
- **Code:** `return prisma.knowledgePublication.findMany({ orderBy: { createdAt: 'desc' } });`
- **Message:** Cannot verify "createdAt" — model "knowledgePublication"

---

### [WARNING] src/services/narrative-reader/observation/drift.ts:68
- **Model:** driftSnapshot
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "driftSnapshot"

---

### [WARNING] src/services/narrative-reader/storage/event_store.ts:68
- **Model:** narrativeEventLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "narrativeEventLog"

---

### [WARNING] src/services/p18/evaluation-collector.ts:105
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/platform/capability/repositories/contract.repository.ts:72
- **Model:** capabilityContract
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "capabilityContract"

---

### [WARNING] src/services/platform/governance/repositories/audit.repository.ts:45
- **Model:** auditLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "auditLog"

---

### [WARNING] src/services/platform/governance/repositories/audit.repository.ts:58
- **Model:** auditLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "auditLog"

---

### [WARNING] src/services/platform/governance/repositories/billing.repository.ts:41
- **Model:** billingRecord
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "billingRecord"

---

### [WARNING] src/services/platform/governance/repositories/license.repository.ts:31
- **Model:** license
- **Field:** `createdAt`
- **Code:** `const licenses = await prisma.license.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })`
- **Message:** Cannot verify "createdAt" — model "license"

---

### [WARNING] src/services/platform/governance/repositories/organization.repository.ts:33
- **Model:** govOrganization
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "govOrganization"

---

### [WARNING] src/services/platform/governance/repositories/organization.repository.ts:44
- **Model:** govOrganization
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "govOrganization"

---

### [WARNING] src/services/platform/governance/repositories/plan.repository.ts:45
- **Model:** subscriptionPlan
- **Field:** `createdAt`
- **Code:** `const plans = await prisma.subscriptionPlan.findMany({ where, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "subscriptionPlan"

---

### [WARNING] src/services/platform/governance/repositories/role.repository.ts:32
- **Model:** role
- **Field:** `createdAt`
- **Code:** `const roles = await prisma.role.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })`
- **Message:** Cannot verify "createdAt" — model "role"

---

### [WARNING] src/services/platform/governance/repositories/subscription.repository.ts:38
- **Model:** subscription
- **Field:** `createdAt`
- **Code:** `const subs = await prisma.subscription.findMany({ where, include: { plan: true }, orderBy: { createdAt: 'desc' } })`
- **Message:** Cannot verify "createdAt" — model "subscription"

---

### [WARNING] src/services/platform/governance/repositories/tenant.repository.ts:30
- **Model:** tenant
- **Field:** `createdAt`
- **Code:** `const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })`
- **Message:** Cannot verify "createdAt" — model "tenant"

---

### [WARNING] src/services/platform/governance/repositories/user.repository.ts:33
- **Model:** govUser
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "govUser"

---

### [WARNING] src/services/platform/governance/services/personal-tenant.service.ts:134
- **Model:** UNKNOWN
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "unknown"

---

### [WARNING] src/services/platform/resource/repositories/contract.repository.ts:60
- **Model:** resourceContract
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "resourceContract"

---

### [WARNING] src/services/platform/resource/repositories/credential.repository.ts:52
- **Model:** resourceCredential
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "resourceCredential"

---

### [WARNING] src/services/platform/resource/repositories/credential.repository.ts:64
- **Model:** resourceCredential
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "resourceCredential"

---

### [WARNING] src/services/platform/resource/repositories/usage.repository.ts:47
- **Model:** resourceUsage
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "resourceUsage"

---

### [WARNING] src/services/platform/workflow/repositories/checkpoint.repository.ts:46
- **Model:** workflowCheckpoint
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowCheckpoint"

---

### [WARNING] src/services/platform/workflow/repositories/checkpoint.repository.ts:69
- **Model:** workflowCheckpoint
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowCheckpoint"

---

### [WARNING] src/services/platform/workflow/repositories/definition.repository.ts:65
- **Model:** workflowDefinition
- **Field:** `updatedAt`
- **Code:** `const records = await prisma.workflowDefinition.findMany({ where, orderBy: { updatedAt: 'desc' } })`
- **Message:** Cannot verify "updatedAt" — model "workflowDefinition"

---

### [WARNING] src/services/platform/workflow/repositories/edge.repository.ts:49
- **Model:** workflowEdge
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowEdge"

---

### [WARNING] src/services/platform/workflow/repositories/edge.repository.ts:61
- **Model:** workflowEdge
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowEdge"

---

### [WARNING] src/services/platform/workflow/repositories/edge.repository.ts:73
- **Model:** workflowEdge
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowEdge"

---

### [WARNING] src/services/platform/workflow/repositories/execution.repository.ts:54
- **Model:** workflowExecution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowExecution"

---

### [WARNING] src/services/platform/workflow/repositories/execution.repository.ts:66
- **Model:** workflowExecution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowExecution"

---

### [WARNING] src/services/platform/workflow/repositories/instance.repository.ts:54
- **Model:** workflowInstance
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowInstance"

---

### [WARNING] src/services/platform/workflow/repositories/instance.repository.ts:68
- **Model:** workflowInstance
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowInstance"

---

### [WARNING] src/services/platform/workflow/repositories/instance.repository.ts:82
- **Model:** workflowInstance
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowInstance"

---

### [WARNING] src/services/platform/workflow/repositories/node.repository.ts:67
- **Model:** workflowNode
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowNode"

---

### [WARNING] src/services/platform/workflow/repositories/node.repository.ts:90
- **Model:** workflowNode
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workflowNode"

---

### [WARNING] src/services/platform/workflow/repositories/template.repository.ts:58
- **Model:** workflowTemplate
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowTemplate"

---

### [WARNING] src/services/platform/workflow/repositories/template.repository.ts:70
- **Model:** workflowTemplate
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowTemplate"

---

### [WARNING] src/services/platform/workflow/repositories/template.repository.ts:81
- **Model:** workflowTemplate
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workflowTemplate"

---

### [WARNING] src/services/platform/workspace/repositories/asset.repository.ts:54
- **Model:** workspaceAsset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceAsset"

---

### [WARNING] src/services/platform/workspace/repositories/asset.repository.ts:62
- **Model:** workspaceAsset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceAsset"

---

### [WARNING] src/services/platform/workspace/repositories/checkpoint.repository.ts:51
- **Model:** workspaceCheckpoint
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceCheckpoint"

---

### [WARNING] src/services/platform/workspace/repositories/conversation.repository.ts:55
- **Model:** workspaceConversation
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'asc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceConversation"

---

### [WARNING] src/services/platform/workspace/repositories/conversation.repository.ts:76
- **Model:** workspaceConversation
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceConversation"

---

### [WARNING] src/services/platform/workspace/repositories/execution.repository.ts:53
- **Model:** workspaceExecution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceExecution"

---

### [WARNING] src/services/platform/workspace/repositories/execution.repository.ts:76
- **Model:** workspaceExecution
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceExecution"

---

### [WARNING] src/services/platform/workspace/repositories/operation.repository.ts:56
- **Model:** workspaceOperation
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceOperation"

---

### [WARNING] src/services/platform/workspace/repositories/operation.repository.ts:65
- **Model:** workspaceOperation
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "workspaceOperation"

---

### [WARNING] src/services/platform/workspace/repositories/workspace.repository.ts:56
- **Model:** workspaceRuntime
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "workspaceRuntime"

---

### [WARNING] src/services/platform/workspace/repositories/workspace.repository.ts:94
- **Model:** workspaceRuntime
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "workspaceRuntime"

---

### [WARNING] src/services/project.service.ts:18
- **Model:** UNKNOWN
- **Field:** `updatedAt`
- **Code:** `orderBy: { updatedAt: 'desc' },`
- **Message:** Cannot verify "updatedAt" — model "unknown"

---

### [WARNING] src/services/region-commission.ts:179
- **Model:** user
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "user"

---

### [WARNING] src/services/runtime-event-ledger.ts:105
- **Model:** invocationLog
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "invocationLog"

---

### [WARNING] src/services/semantic/repositories/relation.repository.ts:42
- **Model:** semanticRelation
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "semanticRelation"

---

### [WARNING] src/services/voice-manager.service.ts:194
- **Model:** voicePreset
- **Field:** `createdAt`
- **Code:** `orderBy: { createdAt: 'desc' },`
- **Message:** Cannot verify "createdAt" — model "voicePreset"


## Auto-Fix Suggestions


