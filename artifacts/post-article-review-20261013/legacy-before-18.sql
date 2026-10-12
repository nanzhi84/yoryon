--
-- PostgreSQL database dump
--

\restrict 4cK53Bf25GfoynZNquwdbjs4dhRXl1uinEZYyhYDPy2M9hj90Or1ZnSM8pT2Pxh

-- Dumped from database version 17.11 (Homebrew)
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: yoryon
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO yoryon;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: yoryon
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO yoryon;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: yoryon
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO yoryon;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: yoryon
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: activation_codes; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.activation_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    batch_id uuid NOT NULL,
    grant_type text NOT NULL,
    grant_content_id uuid,
    grant_collection_id uuid,
    grant_days integer,
    max_uses integer DEFAULT 1 NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activation_codes_collection_ref CHECK (((grant_type <> 'collection'::text) OR (grant_collection_id IS NOT NULL))),
    CONSTRAINT activation_codes_content_ref CHECK (((grant_type <> 'content'::text) OR (grant_content_id IS NOT NULL))),
    CONSTRAINT activation_codes_subscription_days CHECK (((grant_type <> 'subscription'::text) OR (grant_days IS NOT NULL)))
);


ALTER TABLE public.activation_codes OWNER TO yoryon;

--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    target_kind text NOT NULL,
    target_id uuid NOT NULL,
    placement text,
    page_view_id uuid NOT NULL,
    session_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analytics_events OWNER TO yoryon;

--
-- Name: cache_events; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.cache_events (
    id uuid NOT NULL,
    payload text NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    invalidated_at timestamp with time zone,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cache_events OWNER TO yoryon;

--
-- Name: collection_items; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.collection_items (
    collection_id uuid NOT NULL,
    content_id uuid NOT NULL,
    sort_order integer NOT NULL
);


ALTER TABLE public.collection_items OWNER TO yoryon;

--
-- Name: collections; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    cover_media_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.collections OWNER TO yoryon;

--
-- Name: content_media; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.content_media (
    content_id uuid NOT NULL,
    media_id uuid NOT NULL,
    "position" integer NOT NULL,
    exposure text NOT NULL
);


ALTER TABLE public.content_media OWNER TO yoryon;

--
-- Name: content_tags; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.content_tags (
    content_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.content_tags OWNER TO yoryon;

--
-- Name: contents; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    body_markdown text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    visibility text DEFAULT 'public'::text NOT NULL,
    preview_mode text DEFAULT 'none'::text NOT NULL,
    preview_percent integer,
    cover_media_id uuid,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision uuid DEFAULT gen_random_uuid() NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    CONSTRAINT contents_preview_percent_range CHECK (((preview_percent >= 1) AND (preview_percent <= 99)))
);


ALTER TABLE public.contents OWNER TO yoryon;

--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.email_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    purpose text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_verifications OWNER TO yoryon;

--
-- Name: entitlements; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    scope_type text NOT NULL,
    scope_id uuid,
    valid_from timestamp with time zone NOT NULL,
    valid_until timestamp with time zone,
    redemption_id uuid NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.entitlements OWNER TO yoryon;

--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oss_key text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint,
    duration_sec integer,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.media_assets OWNER TO yoryon;

--
-- Name: redemptions; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.redemptions OWNER TO yoryon;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone,
    ip inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO yoryon;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.tags OWNER TO yoryon;

--
-- Name: users; Type: TABLE; Schema: public; Owner: yoryon
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    username public.citext NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO yoryon;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: yoryon
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: yoryon
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	c5f9eb107f524d96416d586d9d9ac953ed059383602ef398725988acaa2c7566	1791655080601
2	8996b2847f23388802df3c8c9b8995b238a33dcbe5ce32da2071c1d7f17db629	1791684271076
3	0bac3e96c74233e9d1ceec593ede7f81171445c109bea5e28316137d0d260c93	1791723226245
4	2ce3e34ad9c4bfa5a9db1697bb6a92d31eb5c6650d192c56f2c97171e9e226d4	1791789134292
5	abc21a32ac77aebdac1267a3f07e4f38f8121c0c72344d4f42189b58d163f341	1791789567749
6	d976c32100a6eae5856454f3838c9cd7b77ebc6fd7d52ec253ccb000a13947b8	1791811056565
\.


--
-- Data for Name: activation_codes; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.activation_codes (id, code, batch_id, grant_type, grant_content_id, grant_collection_id, grant_days, max_uses, used_count, expires_at, status, note, created_at) FROM stdin;
\.


--
-- Data for Name: analytics_events; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.analytics_events (id, event_id, event_type, target_kind, target_id, placement, page_view_id, session_id, received_at) FROM stdin;
ef31f430-ac87-4347-987a-026ae79b4d98	691f2d3e-cf9a-441d-99d6-6616f8a9b1df	view	work	96495fa7-77ec-430f-a554-fa4581acdd14	\N	d6402a2c-e730-42e2-a9ac-d07fff346404	\N	2026-10-13 01:55:16.524374+08
20716b86-1d28-40f9-aa4e-6d7757770dda	20ee3ec5-ae7c-4bdf-84d5-bf07e347b8e5	view	work	43154b8b-1c15-43b6-9641-676ae92a2c11	\N	06d59eae-9d64-4c63-bcc7-d9d84ecc84b1	\N	2026-10-13 01:55:16.524374+08
b7c334b3-49fc-4384-bdbd-5353d800d947	7725fd16-2f88-495e-8ce7-ec0d5500c01b	view	work	3acfaad8-f78e-4f9c-9094-fac08de200b5	\N	fed87b1c-4a3a-4289-9cd5-a3a7125eaf52	\N	2026-10-13 01:55:16.524374+08
1d82df05-c672-420e-9e71-bb57d441e03e	c9b5b946-2b63-4b9d-a099-c7b412725028	view	work	c4f49d1c-2b16-4c36-afd2-23cb763b6ce9	\N	758cafc5-f1ca-43b7-8cc8-beeb8f6614dd	\N	2026-10-13 01:55:16.524374+08
60171ed6-5683-46d7-954c-e0154443ee04	4150c526-5ac7-4d88-8c21-e85458bc80de	view	work	fd3a1cf1-8d56-4ed4-bd81-c4cc44839b4c	\N	a40e6d01-5d7a-4a55-98c3-626f8afebadb	\N	2026-10-13 01:55:16.524374+08
bd52f3e1-0daf-4fe8-b962-4438eb386d30	e4914073-6c7b-4caa-a526-139a4fa10648	view	work	38916af4-0843-4775-bf00-c6b78412770b	\N	d1de151d-cd8f-4f0a-afd8-9b4e98df207d	\N	2026-10-13 01:55:16.524374+08
344c373b-03c9-4d9f-8f84-cec76ccfc119	88cbf191-15b2-4a32-bd57-5ab7179e8e22	view	work	69d5db1c-00a1-4d0c-b973-3ca4f8491e6c	\N	2be13cfd-5d7d-44cf-ba19-15cb48b566d4	\N	2026-10-13 01:55:16.524374+08
1e39b02e-a6e2-4ac4-9b6d-2db42758e91f	ccb5287e-4d6f-4b26-bcc8-6a15a1b6f7cf	view	work	45575249-0381-482b-8e44-b621862fbe26	\N	2c9c38a5-fb0d-4d48-ab4b-ce2f9cdcd3c7	\N	2026-10-13 01:55:16.524374+08
6e8fd2e9-3722-4fae-8c2a-d7a639c4a2a6	232de5a9-594c-4351-a4a3-fe93e363215c	view	work	fcfcbfed-5d78-489a-93e4-d3966f51256d	\N	3abdb9d0-0b14-4042-87da-95117601687a	\N	2026-10-13 01:55:16.524374+08
83016007-6875-4f61-8750-9859a4f1f6dc	ecab52fc-89e1-4bf9-8280-ef17cf697c6d	view	work	60f29209-ff7b-4df8-b2e4-664562d32c34	\N	61e43248-5452-4d0f-be25-7264857dd274	\N	2026-10-13 01:55:16.524374+08
6f628b69-149f-4013-9869-4aceb0175a0c	01acdff8-ac7b-4d44-917b-49f6d79cda25	view	work	e16b749d-8fa8-4270-ad16-716c4f65f5c9	\N	bd87f0f7-7604-4728-adde-8de3af132c36	\N	2026-10-13 01:55:16.524374+08
1b50a53e-c00b-4245-9eca-74ba96185af2	2cf8f0bb-70c8-4108-9b38-01467a2be4ef	view	work	36a415cf-99ae-4a0e-a98e-309888d36fd2	\N	2507ebd9-3a86-4aa8-814d-f7830c7efe75	\N	2026-10-13 01:55:16.524374+08
5e8a7be7-d8ef-4374-8a05-f1b0123161b4	8882a91e-fe3e-4d47-a3fb-21198e3887ed	view	work	4725d07f-c6ae-4b32-a812-c0a8b7add362	\N	dee4e91c-b800-4190-82f7-450c4cdf41a9	\N	2026-10-13 01:55:16.524374+08
b26d948f-e4ea-4e55-aa84-1dbe447165de	04bf18ac-f8fd-4852-bd56-b0a869c4712d	view	work	36198e81-d134-4eb3-a41f-bd1e0202efd5	\N	1847b599-d836-483a-9360-959d78defab7	\N	2026-10-13 01:55:16.524374+08
14b33fae-0499-4c9b-a126-5634d4940274	83d61ea5-1df6-4b52-a1d8-bea7aee66ede	view	work	3b5b216a-9a16-4973-92d4-31fd5efedde0	\N	ac010685-c229-4610-a517-bcf51a185b2b	\N	2026-10-13 01:55:16.524374+08
1fc6da4d-d40a-437a-9482-1c2b2eeede1e	40e85463-d971-4d44-bef8-243b59222532	view	work	13a25a69-e29c-489c-bdf5-39904e08f841	\N	5f138b5a-538a-4ad2-b004-b0655c874bc2	\N	2026-10-13 01:55:16.524374+08
fc3328fb-95cd-4882-a92c-4c4b5affec94	adf35ad9-b6ff-4b3a-adf6-49a8d9622b6a	view	work	94d033fb-7e78-41ca-ab5c-3b2364c1a846	\N	c8e7528d-1f6c-477c-80a0-7f64c87ccb0a	\N	2026-10-13 02:01:46.655913+08
\.


--
-- Data for Name: cache_events; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.cache_events (id, payload, state, attempts, last_error, invalidated_at, verified_at, created_at) FROM stdin;
436cdfda-4068-4126-8246-0fcd456c976c	{"id":"436cdfda-4068-4126-8246-0fcd456c976c","tags":["feed","collections","sitemap","content:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/c/legacy-review"],"contentSlug":null,"revision":null}	pending	0	\N	\N	\N	2026-10-13 01:53:32.5796+08
0d57aceb-452d-4164-8465-753ebf022a96	{"id":"0d57aceb-452d-4164-8465-753ebf022a96","tags":["feed","collections","sitemap","content:legacy-article-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-full","revision":"2026-10-12T17:53:32.957Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.955958+08
4d04a972-52de-4b25-9dbe-5293d5f791bb	{"id":"4d04a972-52de-4b25-9dbe-5293d5f791bb","tags":["feed","collections","sitemap","content:legacy-article-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-marker","revision":"2026-10-12T17:53:32.969Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.968723+08
de425d16-3e51-461a-934d-1335c74aac76	{"id":"de425d16-3e51-461a-934d-1335c74aac76","tags":["feed","collections","sitemap","content:legacy-article-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-percent","revision":"2026-10-12T17:53:32.973Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.973115+08
379f1532-537b-4503-a029-791c68901416	{"id":"379f1532-537b-4503-a029-791c68901416","tags":["feed","collections","sitemap","content:legacy-article-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-public","revision":"2026-10-12T17:53:32.977Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.976802+08
0159dc51-1c57-4e14-a2e4-49288a033c72	{"id":"0159dc51-1c57-4e14-a2e4-49288a033c72","tags":["feed","collections","sitemap","content:legacy-audio-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-full","revision":"2026-10-12T17:53:32.982Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.982496+08
ddd81316-9edc-40d1-aced-9c6fcb29ef2c	{"id":"ddd81316-9edc-40d1-aced-9c6fcb29ef2c","tags":["feed","collections","sitemap","content:legacy-audio-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-marker","revision":"2026-10-12T17:53:32.989Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.988944+08
5be8e6e2-7b19-4388-bebb-174b1209cb50	{"id":"5be8e6e2-7b19-4388-bebb-174b1209cb50","tags":["feed","collections","sitemap","content:legacy-audio-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-percent","revision":"2026-10-12T17:53:32.994Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.994021+08
58f8061c-e159-4526-a595-2633fdb744fc	{"id":"58f8061c-e159-4526-a595-2633fdb744fc","tags":["feed","collections","sitemap","content:legacy-audio-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-public","revision":"2026-10-12T17:53:32.999Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:32.998928+08
5813c612-ba79-4834-921d-0f8742b8b688	{"id":"5813c612-ba79-4834-921d-0f8742b8b688","tags":["feed","collections","sitemap","content:legacy-image-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-full","revision":"2026-10-12T17:53:33.003Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.003736+08
e1873977-1701-4b41-9690-a0fbda4c440b	{"id":"e1873977-1701-4b41-9690-a0fbda4c440b","tags":["feed","collections","sitemap","content:legacy-image-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-marker","revision":"2026-10-12T17:53:33.008Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.008108+08
1bddf772-c1c1-4900-9f72-4332b101bcfb	{"id":"1bddf772-c1c1-4900-9f72-4332b101bcfb","tags":["feed","collections","sitemap","content:legacy-image-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-percent","revision":"2026-10-12T17:53:33.012Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.012202+08
c369b164-7d84-409a-89b5-53c2b946b3e5	{"id":"c369b164-7d84-409a-89b5-53c2b946b3e5","tags":["feed","collections","sitemap","content:legacy-image-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-public","revision":"2026-10-12T17:53:33.016Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.016509+08
d027cf21-bfad-4e4d-96aa-7917d1fd85e8	{"id":"d027cf21-bfad-4e4d-96aa-7917d1fd85e8","tags":["feed","collections","sitemap","content:legacy-video-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-full","revision":"2026-10-12T17:53:33.021Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.02085+08
7334ab2a-263a-4ddd-8095-43bb00354546	{"id":"7334ab2a-263a-4ddd-8095-43bb00354546","tags":["feed","collections","sitemap","content:legacy-video-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-marker","revision":"2026-10-12T17:53:33.024Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.02465+08
b84c9d33-dd82-4d05-8256-65c9606307db	{"id":"b84c9d33-dd82-4d05-8256-65c9606307db","tags":["feed","collections","sitemap","content:legacy-video-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-percent","revision":"2026-10-12T17:53:33.028Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.028717+08
dd94b40d-8002-4ff8-8a4b-57726a7b5f79	{"id":"dd94b40d-8002-4ff8-8a4b-57726a7b5f79","tags":["feed","collections","sitemap","content:legacy-video-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-public","revision":"2026-10-12T17:53:33.033Z"}	pending	0	\N	\N	\N	2026-10-13 01:53:33.033092+08
b6683a41-9e89-4ce0-b5f5-d41ab1dcd148	{"id":"b6683a41-9e89-4ce0-b5f5-d41ab1dcd148","tags":["feed","collections","sitemap","content:legacy-article-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-full","revision":"2026-10-12T17:54:28.600Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.597373+08
cac96326-1d66-42fd-9b37-c5aa9bce0cc1	{"id":"cac96326-1d66-42fd-9b37-c5aa9bce0cc1","tags":["feed","collections","sitemap","content:legacy-article-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-marker","revision":"2026-10-12T17:54:28.611Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.61011+08
e1d4b7f8-390e-4a26-93eb-8a694739a618	{"id":"e1d4b7f8-390e-4a26-93eb-8a694739a618","tags":["feed","collections","sitemap","content:legacy-article-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-percent","revision":"2026-10-12T17:54:28.622Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.621215+08
0b0d7e09-2ccc-4804-a985-4fc7b2c5a039	{"id":"0b0d7e09-2ccc-4804-a985-4fc7b2c5a039","tags":["feed","collections","sitemap","content:legacy-article-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-public","revision":"2026-10-12T17:54:28.628Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.627801+08
4ca77a36-e696-4006-a004-3c4cb2734941	{"id":"4ca77a36-e696-4006-a004-3c4cb2734941","tags":["feed","collections","sitemap","content:legacy-audio-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-full","revision":"2026-10-12T17:54:28.635Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.634635+08
4cf7d970-7002-4785-81d2-3a414a511c4b	{"id":"4cf7d970-7002-4785-81d2-3a414a511c4b","tags":["feed","collections","sitemap","content:legacy-audio-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-marker","revision":"2026-10-12T17:54:28.643Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.642695+08
5f631001-e517-4381-b624-1914e2c97243	{"id":"5f631001-e517-4381-b624-1914e2c97243","tags":["feed","collections","sitemap","content:legacy-audio-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-percent","revision":"2026-10-12T17:54:28.650Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.649641+08
cf837db1-2404-42fc-a711-ea3a7faf7b8b	{"id":"cf837db1-2404-42fc-a711-ea3a7faf7b8b","tags":["feed","collections","sitemap","content:legacy-audio-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-audio-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-audio-public","revision":"2026-10-12T17:54:28.657Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.656565+08
6d8b4c95-b641-4d12-aaca-7fc61ce5b4dc	{"id":"6d8b4c95-b641-4d12-aaca-7fc61ce5b4dc","tags":["feed","collections","sitemap","content:legacy-image-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-full","revision":"2026-10-12T17:54:28.663Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.663395+08
f00773fe-04ba-4576-8fcc-9e60541236af	{"id":"f00773fe-04ba-4576-8fcc-9e60541236af","tags":["feed","collections","sitemap","content:legacy-image-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-marker","revision":"2026-10-12T17:54:28.670Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.669448+08
08c63cde-9284-4195-b582-25766284536e	{"id":"08c63cde-9284-4195-b582-25766284536e","tags":["feed","collections","sitemap","content:legacy-image-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-percent","revision":"2026-10-12T17:54:28.676Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.675959+08
53300c82-a06b-466f-9946-aaf0f9203bf5	{"id":"53300c82-a06b-466f-9946-aaf0f9203bf5","tags":["feed","collections","sitemap","content:legacy-image-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-public","revision":"2026-10-12T17:54:28.682Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.682084+08
a65eaf4b-24a4-4586-8ead-5a9bcde5b586	{"id":"a65eaf4b-24a4-4586-8ead-5a9bcde5b586","tags":["feed","collections","sitemap","content:legacy-video-full","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-full","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-full","revision":"2026-10-12T17:54:28.688Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.688157+08
02086dc3-8fa2-4bdf-8f5d-6f0ab73b2838	{"id":"02086dc3-8fa2-4bdf-8f5d-6f0ab73b2838","tags":["feed","collections","sitemap","content:legacy-video-marker","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-marker","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-marker","revision":"2026-10-12T17:54:28.695Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.694277+08
74b2842d-a194-4959-a9d0-743e0187282f	{"id":"74b2842d-a194-4959-a9d0-743e0187282f","tags":["feed","collections","sitemap","content:legacy-video-percent","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-percent","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-percent","revision":"2026-10-12T17:54:28.700Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.699555+08
6a76ec51-f22c-48a0-965f-99b607851210	{"id":"6a76ec51-f22c-48a0-965f-99b607851210","tags":["feed","collections","sitemap","content:legacy-video-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-video-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-video-public","revision":"2026-10-12T17:54:28.706Z"}	pending	0	\N	\N	\N	2026-10-13 01:54:28.705315+08
a90ebeca-869e-4d8b-931d-63858bc8c301	{"id":"a90ebeca-869e-4d8b-931d-63858bc8c301","tags":["feed","collections","sitemap","content:legacy-article-public","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-article-public","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-article-public","revision":null}	pending	0	\N	\N	\N	2026-10-13 01:55:16.170629+08
b6547d7f-7827-4b72-9c29-3befb53e4cdd	{"id":"b6547d7f-7827-4b72-9c29-3befb53e4cdd","tags":["feed","collections","sitemap","content:legacy-image-present","tag:legacy-review","collection:legacy-review"],"paths":["/","/c","/sitemap.xml","/p/legacy-image-present","/tags/legacy-review","/c/legacy-review"],"contentSlug":"legacy-image-present","revision":"2026-10-12T18:01:46.327Z"}	pending	0	\N	\N	\N	2026-10-13 02:01:46.326367+08
\.


--
-- Data for Name: collection_items; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.collection_items (collection_id, content_id, sort_order) FROM stdin;
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	96495fa7-77ec-430f-a554-fa4581acdd14	1
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	43154b8b-1c15-43b6-9641-676ae92a2c11	2
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	3acfaad8-f78e-4f9c-9094-fac08de200b5	3
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	c4f49d1c-2b16-4c36-afd2-23cb763b6ce9	4
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	fd3a1cf1-8d56-4ed4-bd81-c4cc44839b4c	5
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	38916af4-0843-4775-bf00-c6b78412770b	6
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	69d5db1c-00a1-4d0c-b973-3ca4f8491e6c	7
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	45575249-0381-482b-8e44-b621862fbe26	8
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	fcfcbfed-5d78-489a-93e4-d3966f51256d	9
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	60f29209-ff7b-4df8-b2e4-664562d32c34	10
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	e16b749d-8fa8-4270-ad16-716c4f65f5c9	11
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	36a415cf-99ae-4a0e-a98e-309888d36fd2	12
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	4725d07f-c6ae-4b32-a812-c0a8b7add362	13
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	36198e81-d134-4eb3-a41f-bd1e0202efd5	14
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	3b5b216a-9a16-4973-92d4-31fd5efedde0	15
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	13a25a69-e29c-489c-bdf5-39904e08f841	16
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	94d033fb-7e78-41ca-ab5c-3b2364c1a846	17
\.


--
-- Data for Name: collections; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.collections (id, slug, title, description, visibility, cover_media_id, created_at, updated_at) FROM stdin;
4d2e8fc9-7fe0-441a-8349-cad0772f73b1	legacy-review	隔离迁移验收合集		public	\N	2026-10-13 01:53:32.5796+08	2026-10-13 01:53:32.5796+08
\.


--
-- Data for Name: content_media; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.content_media (content_id, media_id, "position", exposure) FROM stdin;
fd3a1cf1-8d56-4ed4-bd81-c4cc44839b4c	9f6fbeb9-a017-443b-96c3-273fb3069939	0	paid
fd3a1cf1-8d56-4ed4-bd81-c4cc44839b4c	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
38916af4-0843-4775-bf00-c6b78412770b	9f6fbeb9-a017-443b-96c3-273fb3069939	0	paid
38916af4-0843-4775-bf00-c6b78412770b	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
69d5db1c-00a1-4d0c-b973-3ca4f8491e6c	9f6fbeb9-a017-443b-96c3-273fb3069939	0	paid
69d5db1c-00a1-4d0c-b973-3ca4f8491e6c	676802b2-fc59-413b-99ba-9061ae5b12e5	1	paid
45575249-0381-482b-8e44-b621862fbe26	e5fa72f0-bdad-4318-9db5-6750d39ff930	0	free
45575249-0381-482b-8e44-b621862fbe26	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
fcfcbfed-5d78-489a-93e4-d3966f51256d	1de0dcee-0514-43dd-a0cf-3eba7d0a781c	0	paid
fcfcbfed-5d78-489a-93e4-d3966f51256d	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
60f29209-ff7b-4df8-b2e4-664562d32c34	1de0dcee-0514-43dd-a0cf-3eba7d0a781c	0	paid
60f29209-ff7b-4df8-b2e4-664562d32c34	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
e16b749d-8fa8-4270-ad16-716c4f65f5c9	1de0dcee-0514-43dd-a0cf-3eba7d0a781c	0	paid
e16b749d-8fa8-4270-ad16-716c4f65f5c9	676802b2-fc59-413b-99ba-9061ae5b12e5	1	paid
36a415cf-99ae-4a0e-a98e-309888d36fd2	3ae68f3a-2f9e-4a61-a5ed-bfa0d4301cf5	0	free
36a415cf-99ae-4a0e-a98e-309888d36fd2	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
4725d07f-c6ae-4b32-a812-c0a8b7add362	612298b6-733d-432f-ba5d-837083788fe6	0	paid
4725d07f-c6ae-4b32-a812-c0a8b7add362	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
36198e81-d134-4eb3-a41f-bd1e0202efd5	612298b6-733d-432f-ba5d-837083788fe6	0	paid
36198e81-d134-4eb3-a41f-bd1e0202efd5	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
3b5b216a-9a16-4973-92d4-31fd5efedde0	612298b6-733d-432f-ba5d-837083788fe6	0	paid
3b5b216a-9a16-4973-92d4-31fd5efedde0	676802b2-fc59-413b-99ba-9061ae5b12e5	1	paid
13a25a69-e29c-489c-bdf5-39904e08f841	974f9f1f-d735-4f77-a329-891750cd0c7a	0	free
13a25a69-e29c-489c-bdf5-39904e08f841	676802b2-fc59-413b-99ba-9061ae5b12e5	1	free
94d033fb-7e78-41ca-ab5c-3b2364c1a846	3ae68f3a-2f9e-4a61-a5ed-bfa0d4301cf5	0	free
\.


--
-- Data for Name: content_tags; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.content_tags (content_id, tag_id) FROM stdin;
96495fa7-77ec-430f-a554-fa4581acdd14	682d0d2c-3e79-4b77-8b3b-710e314370c5
43154b8b-1c15-43b6-9641-676ae92a2c11	682d0d2c-3e79-4b77-8b3b-710e314370c5
3acfaad8-f78e-4f9c-9094-fac08de200b5	682d0d2c-3e79-4b77-8b3b-710e314370c5
c4f49d1c-2b16-4c36-afd2-23cb763b6ce9	682d0d2c-3e79-4b77-8b3b-710e314370c5
fd3a1cf1-8d56-4ed4-bd81-c4cc44839b4c	682d0d2c-3e79-4b77-8b3b-710e314370c5
38916af4-0843-4775-bf00-c6b78412770b	682d0d2c-3e79-4b77-8b3b-710e314370c5
69d5db1c-00a1-4d0c-b973-3ca4f8491e6c	682d0d2c-3e79-4b77-8b3b-710e314370c5
45575249-0381-482b-8e44-b621862fbe26	682d0d2c-3e79-4b77-8b3b-710e314370c5
fcfcbfed-5d78-489a-93e4-d3966f51256d	682d0d2c-3e79-4b77-8b3b-710e314370c5
60f29209-ff7b-4df8-b2e4-664562d32c34	682d0d2c-3e79-4b77-8b3b-710e314370c5
e16b749d-8fa8-4270-ad16-716c4f65f5c9	682d0d2c-3e79-4b77-8b3b-710e314370c5
36a415cf-99ae-4a0e-a98e-309888d36fd2	682d0d2c-3e79-4b77-8b3b-710e314370c5
4725d07f-c6ae-4b32-a812-c0a8b7add362	682d0d2c-3e79-4b77-8b3b-710e314370c5
36198e81-d134-4eb3-a41f-bd1e0202efd5	682d0d2c-3e79-4b77-8b3b-710e314370c5
3b5b216a-9a16-4973-92d4-31fd5efedde0	682d0d2c-3e79-4b77-8b3b-710e314370c5
13a25a69-e29c-489c-bdf5-39904e08f841	682d0d2c-3e79-4b77-8b3b-710e314370c5
94d033fb-7e78-41ca-ab5c-3b2364c1a846	682d0d2c-3e79-4b77-8b3b-710e314370c5
\.


--
-- Data for Name: contents; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.contents (id, type, slug, title, description, body_markdown, status, visibility, preview_mode, preview_percent, cover_media_id, published_at, created_at, updated_at, revision, is_pinned) FROM stdin;
96495fa7-77ec-430f-a554-fa4581acdd14	article	legacy-article-full	旧长文 full		旧长文开头段落。\n\n旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。	published	paid	full	\N	\N	2026-10-13 01:54:28.602+08	2026-10-13 01:53:32.955958+08	2026-10-13 01:54:28.6+08	f5faae73-ef41-4b55-91e3-8203f305e578	f
43154b8b-1c15-43b6-9641-676ae92a2c11	article	legacy-article-marker	旧长文 marker		旧长文开头段落。\n\n<!-- more -->\n\n旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。	published	paid	marker	\N	\N	2026-10-13 01:54:28.613+08	2026-10-13 01:53:32.968723+08	2026-10-13 01:54:28.611+08	66ff8552-12c3-47fd-a6c7-59d3db154989	f
3acfaad8-f78e-4f9c-9094-fac08de200b5	article	legacy-article-percent	旧长文 percent		旧长文开头段落。\n\n旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。	published	paid	percent	20	\N	2026-10-13 01:54:28.622+08	2026-10-13 01:53:32.973115+08	2026-10-13 01:54:28.622+08	a5a34696-af67-4596-acf8-62e7d1bbfae2	f
fd3a1cf1-8d56-4ed4-bd81-c4cc44839b4c	audio	legacy-audio-full	旧版迁移 audio full		旧版允许阅读段落 legacy-audio-full。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n后续段落 此模式允许全文。	published	paid	full	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:32.982496+08	2026-10-13 01:54:28.635+08	12a1efe7-0118-4e28-a75d-3b48558df7a7	f
38916af4-0843-4775-bf00-c6b78412770b	audio	legacy-audio-marker	旧版迁移 audio marker		旧版允许阅读段落 legacy-audio-marker。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n<!-- more -->\n\n后续段落 LEGACY_PRIVATE_legacy-audio-marker。	published	paid	marker	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:32.988944+08	2026-10-13 01:54:28.643+08	e0e48f82-c6f6-4e0f-ab41-9f3d6fbbc51b	f
69d5db1c-00a1-4d0c-b973-3ca4f8491e6c	audio	legacy-audio-percent	旧版迁移 audio percent		旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。\n\n![预览后的正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n仅授权可见 LEGACY_PRIVATE_legacy-audio-percent	published	paid	percent	20	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:32.994021+08	2026-10-13 01:54:28.65+08	5827d636-2485-439d-a100-4252e9898cae	f
45575249-0381-482b-8e44-b621862fbe26	audio	legacy-audio-public	旧版迁移 audio public		旧版允许阅读段落 legacy-audio-public。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n后续段落 此模式允许全文。	published	public	full	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:32.998928+08	2026-10-13 01:54:28.657+08	9f2f0090-7a87-46ad-b0df-5d693f6ede73	f
fcfcbfed-5d78-489a-93e4-d3966f51256d	image	legacy-image-full	旧版迁移 image full		旧版允许阅读段落 legacy-image-full。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n后续段落 此模式允许全文。	published	paid	full	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.003736+08	2026-10-13 01:54:28.663+08	311e9b95-fc9e-42a0-8a6d-c41a200dd10a	f
60f29209-ff7b-4df8-b2e4-664562d32c34	image	legacy-image-marker	旧版迁移 image marker		旧版允许阅读段落 legacy-image-marker。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n<!-- more -->\n\n后续段落 LEGACY_PRIVATE_legacy-image-marker。	published	paid	marker	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.008108+08	2026-10-13 01:54:28.67+08	09b1f6c2-73f5-4b2a-a5fc-3920c5e4a239	f
e16b749d-8fa8-4270-ad16-716c4f65f5c9	image	legacy-image-percent	旧版迁移 image percent		旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。\n\n![预览后的正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n仅授权可见 LEGACY_PRIVATE_legacy-image-percent	published	paid	percent	20	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.012202+08	2026-10-13 01:54:28.676+08	aceb9b41-9ea5-4edc-9865-2901d8793443	f
36a415cf-99ae-4a0e-a98e-309888d36fd2	image	legacy-image-public	旧版迁移 image public		旧版允许阅读段落 legacy-image-public。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n后续段落 此模式允许全文。	published	public	full	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.016509+08	2026-10-13 01:54:28.682+08	9d9a7210-0cf4-4f9f-a2cf-eb8efa9f8928	f
4725d07f-c6ae-4b32-a812-c0a8b7add362	video	legacy-video-full	旧版迁移 video full		旧版允许阅读段落 legacy-video-full。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n后续段落 此模式允许全文。	published	paid	full	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.02085+08	2026-10-13 01:54:28.688+08	bed64372-faf8-44bd-8604-96a59cdd1d98	f
36198e81-d134-4eb3-a41f-bd1e0202efd5	video	legacy-video-marker	旧版迁移 video marker		旧版允许阅读段落 legacy-video-marker。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n<!-- more -->\n\n后续段落 LEGACY_PRIVATE_legacy-video-marker。	published	paid	marker	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.02465+08	2026-10-13 01:54:28.695+08	9893b6d4-96eb-4afc-b0e8-63dc5aa33e97	f
3b5b216a-9a16-4973-92d4-31fd5efedde0	video	legacy-video-percent	旧版迁移 video percent		旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。旧版百分比边界保留，正文字符不应因主媒体补入而消失。\n\n![预览后的正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n仅授权可见 LEGACY_PRIVATE_legacy-video-percent	published	paid	percent	20	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.028717+08	2026-10-13 01:54:28.7+08	6305da5c-20e8-44ae-9925-0f8c9f3d4f74	f
13a25a69-e29c-489c-bdf5-39904e08f841	video	legacy-video-public	旧版迁移 video public		旧版允许阅读段落 legacy-video-public。\n\n![正文图片](/api/media/676802b2-fc59-413b-99ba-9061ae5b12e5)\n\n后续段落 此模式允许全文。	published	public	full	\N	\N	2026-10-01 09:00:00+08	2026-10-13 01:53:33.033092+08	2026-10-13 01:54:28.706+08	62c812b2-1eeb-468d-966e-a09a5969f96e	f
c4f49d1c-2b16-4c36-afd2-23cb763b6ce9	article	legacy-article-public	旧长文 public		旧长文开头段落。\n\n旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。旧长文后续正文保持。	published	public	full	\N	\N	2026-10-13 01:54:28.628+08	2026-10-13 01:53:32.976802+08	2026-10-13 01:54:28.628+08	a99600ea-9397-4d2d-9dfd-c4d258876c15	t
94d033fb-7e78-41ca-ab5c-3b2364c1a846	image	legacy-image-present	旧主媒体已在正文中		开头文字，主媒体保持此编排位置。\n\n![已存在的主媒体](/api/media/3ae68f3a-2f9e-4a61-a5ed-bfa0d4301cf5)\n\n结尾文字，迁移不能重复补入图片。	published	public	full	\N	\N	2026-10-13 02:01:46.331+08	2026-10-13 02:01:46.326367+08	2026-10-13 02:01:46.327+08	f74679c6-b8d1-4be9-8097-1dbc916002c3	f
\.


--
-- Data for Name: email_verifications; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.email_verifications (id, email, purpose, code_hash, expires_at, attempts, consumed_at, created_at) FROM stdin;
\.


--
-- Data for Name: entitlements; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.entitlements (id, user_id, scope_type, scope_id, valid_from, valid_until, redemption_id, revoked_at, revoked_by, revoke_reason, created_at) FROM stdin;
\.


--
-- Data for Name: media_assets; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.media_assets (id, oss_key, mime_type, size_bytes, duration_sec, width, height, created_at) FROM stdin;
676802b2-fc59-413b-99ba-9061ae5b12e5	media/8a019a3de358fb977b6ec8ed379ca03ea89121365353c3ec4f7556c4f3a0f9a8.png	image/png	312	\N	160	90	2026-10-13 01:53:32.982496+08
e5fa72f0-bdad-4318-9db5-6750d39ff930	media/4fd9a7812aeb16f67361aeb3da5a923585ad1333ba1ac6648929a07fde3fc29e.mp3	audio/mpeg	8482	\N	\N	\N	2026-10-13 01:53:32.982496+08
3ae68f3a-2f9e-4a61-a5ed-bfa0d4301cf5	media/81ac6eb09954ae4852b5839ba8d6fbb10f1373cf5b9359c6a5d7d702f4d425cf.png	image/png	314	\N	160	90	2026-10-13 01:53:33.003736+08
974f9f1f-d735-4f77-a329-891750cd0c7a	media/67f76c68e1aeae4a211bdfc2a52a21bd05c6a469635c2b1d1e291d871a9eb2f6.mp4	video/mp4	21743	\N	\N	\N	2026-10-13 01:53:33.02085+08
9f6fbeb9-a017-443b-96c3-273fb3069939	media/38c518dc77c6429ac0e5bbe7c45e78f1537230c975cb5fd391e7efeecf366977.mp3	audio/mpeg	8482	\N	\N	\N	2026-10-13 01:54:28.634635+08
1de0dcee-0514-43dd-a0cf-3eba7d0a781c	media/7ead68eaa47d1d95f7377acc05f9a62aff7b40e703aed3db07433ba00645970a.png	image/png	310	\N	160	90	2026-10-13 01:54:28.663395+08
612298b6-733d-432f-ba5d-837083788fe6	media/6a31734065bb162e85750324820ab377d889e763287590d643907760f2863e7b.mp4	video/mp4	2258	\N	\N	\N	2026-10-13 01:54:28.688157+08
\.


--
-- Data for Name: redemptions; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.redemptions (id, code_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.sessions (id, token_hash, user_id, expires_at, last_used_at, ip, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.tags (id, slug, name) FROM stdin;
682d0d2c-3e79-4b77-8b3b-710e314370c5	legacy-review	legacy-review
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: yoryon
--

COPY public.users (id, email, username, password_hash, role, status, created_at, updated_at) FROM stdin;
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: yoryon
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 6, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: yoryon
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: activation_codes activation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: cache_events cache_events_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.cache_events
    ADD CONSTRAINT cache_events_pkey PRIMARY KEY (id);


--
-- Name: collection_items collection_items_collection_id_content_id_pk; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_collection_id_content_id_pk PRIMARY KEY (collection_id, content_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: content_media content_media_content_id_media_id_pk; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.content_media
    ADD CONSTRAINT content_media_content_id_media_id_pk PRIMARY KEY (content_id, media_id);


--
-- Name: content_tags content_tags_content_id_tag_id_pk; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.content_tags
    ADD CONSTRAINT content_tags_content_id_tag_id_pk PRIMARY KEY (content_id, tag_id);


--
-- Name: contents contents_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);


--
-- Name: entitlements entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (id);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: redemptions redemptions_code_user_unique; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_code_user_unique UNIQUE (code_id, user_id);


--
-- Name: redemptions redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activation_codes_code_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX activation_codes_code_unique ON public.activation_codes USING btree (code);


--
-- Name: analytics_events_event_id_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX analytics_events_event_id_unique ON public.analytics_events USING btree (event_id);


--
-- Name: analytics_events_received_at_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX analytics_events_received_at_idx ON public.analytics_events USING btree (received_at);


--
-- Name: analytics_events_target_time_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX analytics_events_target_time_idx ON public.analytics_events USING btree (target_kind, target_id, received_at);


--
-- Name: collection_items_content_id_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX collection_items_content_id_idx ON public.collection_items USING btree (content_id);


--
-- Name: collections_slug_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX collections_slug_unique ON public.collections USING btree (slug);


--
-- Name: content_media_media_id_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX content_media_media_id_idx ON public.content_media USING btree (media_id);


--
-- Name: content_tags_tag_id_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX content_tags_tag_id_idx ON public.content_tags USING btree (tag_id);


--
-- Name: contents_slug_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX contents_slug_unique ON public.contents USING btree (slug);


--
-- Name: contents_status_published_at_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX contents_status_published_at_idx ON public.contents USING btree (status, published_at);


--
-- Name: entitlements_redemption_id_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX entitlements_redemption_id_unique ON public.entitlements USING btree (redemption_id);


--
-- Name: entitlements_user_scope_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX entitlements_user_scope_idx ON public.entitlements USING btree (user_id, scope_type, scope_id);


--
-- Name: media_assets_oss_key_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX media_assets_oss_key_unique ON public.media_assets USING btree (oss_key);


--
-- Name: sessions_token_hash_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX sessions_token_hash_unique ON public.sessions USING btree (token_hash);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: tags_slug_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX tags_slug_unique ON public.tags USING btree (slug);


--
-- Name: users_email_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);


--
-- Name: users_username_unique; Type: INDEX; Schema: public; Owner: yoryon
--

CREATE UNIQUE INDEX users_username_unique ON public.users USING btree (username);


--
-- Name: collection_items collection_items_collection_id_collections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_collection_id_collections_id_fk FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_items collection_items_content_id_contents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.collection_items
    ADD CONSTRAINT collection_items_content_id_contents_id_fk FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: collections collections_cover_media_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_cover_media_id_media_assets_id_fk FOREIGN KEY (cover_media_id) REFERENCES public.media_assets(id);


--
-- Name: content_media content_media_content_id_contents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.content_media
    ADD CONSTRAINT content_media_content_id_contents_id_fk FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: content_media content_media_media_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.content_media
    ADD CONSTRAINT content_media_media_id_media_assets_id_fk FOREIGN KEY (media_id) REFERENCES public.media_assets(id);


--
-- Name: content_tags content_tags_content_id_contents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.content_tags
    ADD CONSTRAINT content_tags_content_id_contents_id_fk FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: content_tags content_tags_tag_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.content_tags
    ADD CONSTRAINT content_tags_tag_id_tags_id_fk FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: contents contents_cover_media_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_cover_media_id_media_assets_id_fk FOREIGN KEY (cover_media_id) REFERENCES public.media_assets(id);


--
-- Name: entitlements entitlements_redemption_id_redemptions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_redemption_id_redemptions_id_fk FOREIGN KEY (redemption_id) REFERENCES public.redemptions(id);


--
-- Name: entitlements entitlements_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: redemptions redemptions_code_id_activation_codes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_code_id_activation_codes_id_fk FOREIGN KEY (code_id) REFERENCES public.activation_codes(id);


--
-- Name: redemptions redemptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: yoryon
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 4cK53Bf25GfoynZNquwdbjs4dhRXl1uinEZYyhYDPy2M9hj90Or1ZnSM8pT2Pxh

