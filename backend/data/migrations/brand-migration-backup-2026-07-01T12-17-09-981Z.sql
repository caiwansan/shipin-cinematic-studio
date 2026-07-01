--
-- PostgreSQL database dump
--

\restrict cxinCVwzmgYLbr5AbJAc8tNdA0zkhk1XiI0AmHptOv2bfQzIITsVsdBb1QQjtPx

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: kmki_geo_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kmki_geo_projects (id, "userId", name, topic, industry, language, country, status, config, workspace_id, "deletedAt", "createdAt", "updatedAt", keywords, website, "brandId", "brandSnapshot", "brandVersion", trigger) FROM stdin;
71c907df-4359-4285-ab08-4d02a22ac314	test-user-1	测试项目	AI短视频		zh	\N	draft	{}	d3a0f0bf-dce3-44b0-8b09-d746660718b5	\N	2026-06-28 19:23:23.7	2026-06-28 19:23:23.748	\N	\N	\N	\N	\N	manual
c4d09e09-8dd2-41c1-839b-aab976356205	test-user	AI Agent测试	AI Agents		zh	\N	draft	{}	e8932aba-a6dc-428d-b8c1-f3f504e6f75e	\N	2026-06-28 19:23:37.234	2026-06-28 19:23:37.241	\N	\N	\N	\N	\N	manual
913e9b14-7790-45c3-bffc-7e5d7050270e	test	测试项目	AI大模型		zh	\N	draft	{}	45c7ae2a-885c-4677-91b5-9fed2757ec1c	\N	2026-06-28 19:26:12.964	2026-06-28 19:26:12.97	\N	\N	\N	\N	\N	manual
ef1c89b2-88f4-4da4-a9b5-5495828f3934	test-user	Test GEO Project	AI Video Generation		zh	\N	draft	{}	6f5d57a0-bb22-4891-a81d-0cbeb3742f8a	\N	2026-06-28 19:26:25.484	2026-06-28 19:26:25.492	\N	\N	\N	\N	\N	manual
c333fed8-abc9-4b02-9a7f-12acfb7e3f59	test-user	Test GEO Project	AI Video Generation		zh	\N	draft	{}	0d475ade-a8e1-4b90-b6d8-93ffcc0bab5f	\N	2026-06-28 19:26:25.542	2026-06-28 19:26:25.545	\N	\N	\N	\N	\N	manual
e7e4dbeb-bfe4-435a-b4e6-298937873b0b	test-user	E2E Test	AI Agents		zh	\N	draft	{}	d7d73bf6-9753-4bd4-96d5-d88f8f18d54e	\N	2026-06-28 19:30:23.984	2026-06-28 19:30:23.991	\N	\N	\N	\N	\N	manual
2cedd34f-3c5a-4f3e-82a9-a380a2b4c5d2	9e5555de-0734-479c-b4b6-d831e1c120d5	测试品牌	\N	科技	zh	\N	active	{}	\N	\N	2026-06-30 18:47:30.174	2026-06-30 18:47:30.174	["AI", "SaaS", "品牌优化"]	https://example.com	\N	\N	\N	manual
066a3883-1eb5-4b31-89ec-5040e9dd98d1	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜测试	\N	AI	zh	\N	active	{}	\N	\N	2026-06-30 18:51:33.804	2026-06-30 18:51:33.804	["AI视频", "短剧", "品牌"]	https://kunlunjing.com	\N	\N	\N	manual
4cb1d3b3-728e-4cc0-93e9-e736650bcd59	test-user	E2E Final	AI Agents		zh	\N	active	{}	c782d639-c62f-4b35-8521-2e6829d67b76	\N	2026-06-28 19:31:13.621	2026-06-28 19:31:13.66	\N	\N	\N	\N	\N	manual
d4856c2d-52d8-44f2-a84e-8e86e2e5817a	e2e-test	E2E Test - KQ Pipeline	Testing knowledge quality workflow		zh	\N	draft	{}	44b11883-1e78-401d-af2c-f13eb063b6b7	\N	2026-06-29 05:08:04.76	2026-06-29 05:08:04.765	\N	\N	\N	\N	\N	manual
142528bc-0bf0-44c8-8b28-d1625ec3c2e0	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:52:55.834	2026-06-30 18:52:55.834	["AI短剧", "数字人", "品牌"]	https://kunlunjing.com	\N	\N	\N	manual
c3bd5323-457b-435c-a20b-8d263308d2ff	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜AI	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:53:53.098	2026-06-30 18:53:53.098	["AI短剧", "数字人", "品牌"]	https://kunlunjing.com	\N	\N	\N	manual
ea48b2b7-6e73-4826-b778-8f8fbfd2284d	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜扫描2	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:54:49.708	2026-06-30 18:54:49.708	["AI短剧", "数字人", "品牌"]	https://kunlunjing.com	\N	\N	\N	manual
85512707-3daf-4564-9100-4f045469c65a	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜v3	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:55:42.25	2026-06-30 18:55:42.25	["短剧", "AI视频", "数字人"]	https://kunlunjing.com	\N	\N	\N	manual
c46b6a11-b736-42cc-a040-6060fcf7549e	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜v4	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:56:33.188	2026-06-30 18:56:33.188	["短剧", "AI视频", "数字人"]	https://kunlunjing.com	\N	\N	\N	manual
13c59d0e-ab37-4df8-af2d-1019b94f7c9a	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜v5	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:58:47.789	2026-06-30 18:58:47.789	["短剧", "AI视频", "数字人"]	https://kunlunjing.com	\N	\N	\N	manual
bbf15e50-63b6-4010-bc0a-34a184489edd	9e5555de-0734-479c-b4b6-d831e1c120d5	昆仑镜v6	\N	AI视频	zh	\N	active	{}	\N	\N	2026-06-30 18:59:48.913	2026-06-30 18:59:48.913	["短剧", "AI视频", "数字人"]	https://kunlunjing.com	\N	\N	\N	manual
df055be8-b681-4ae7-bd10-837bea010f35	0ba5bf98-7005-4019-a431-6a0fb4b2d28d	昆仑镜AI系统	\N	人工只能	zh	\N	active	{}	\N	\N	2026-06-30 19:09:45.278	2026-06-30 19:09:45.278	"小说，短剧，GEO"	https://aigc.fushtn.com	\N	\N	\N	manual
d61d7c0b-d005-483e-a524-6ebacb963f5e	0ba5bf98-7005-4019-a431-6a0fb4b2d28d	昆仑镜系统			zh	\N	draft	{}	\N	\N	2026-07-01 10:58:44.357	2026-07-01 10:58:44.357	\N	\N	\N	\N	\N	manual
b237a62f-9e17-4825-a1a9-a78dee307ee8	0ba5bf98-7005-4019-a431-6a0fb4b2d28d	昆仑镜系统			zh	\N	draft	{}	\N	\N	2026-07-01 10:59:42.495	2026-07-01 10:59:42.495	\N	\N	\N	\N	\N	manual
\.


--
-- PostgreSQL database dump complete
--

\unrestrict cxinCVwzmgYLbr5AbJAc8tNdA0zkhk1XiI0AmHptOv2bfQzIITsVsdBb1QQjtPx

