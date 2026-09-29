-- AAIR Lab - complete PostgreSQL schema for pgAdmin 4 Query Tool.
-- Generated from the live aair_db schema on PostgreSQL 18.4.
-- Contains schema objects and default role permissions only; no user or business data.
-- Run while connected to a NEW, EMPTY database. Do not run over an existing AAIR database.

BEGIN;


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: aair_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aair_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END
$$;


--
-- Name: validate_review_case(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_review_case() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    left_document_id BIGINT;
    right_document_id BIGINT;
    reviewer_role VARCHAR(30);
    creator_role VARCHAR(30);
BEGIN
    SELECT document_id
    INTO left_document_id
    FROM annotation_tasks
    WHERE id = NEW.left_task_id;

    SELECT document_id
    INTO right_document_id
    FROM annotation_tasks
    WHERE id = NEW.right_task_id;

    IF left_document_id IS NULL OR right_document_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy task nguồn của review case';
    END IF;

    IF left_document_id <> right_document_id THEN
        RAISE EXCEPTION 'Hai task review phải thuộc cùng một tài liệu';
    END IF;

    IF NEW.document_id <> left_document_id THEN
        RAISE EXCEPTION 'document_id không khớp với task nguồn';
    END IF;

    SELECT role
    INTO reviewer_role
    FROM users
    WHERE id = NEW.assigned_to;

    IF reviewer_role IS DISTINCT FROM 'REVIEWER' THEN
        RAISE EXCEPTION 'assigned_to phải là tài khoản REVIEWER';
    END IF;

    SELECT role
    INTO creator_role
    FROM users
    WHERE id = NEW.created_by;

    IF creator_role IS DISTINCT FROM 'MANAGER' THEN
        RAISE EXCEPTION 'created_by phải là tài khoản MANAGER';
    END IF;

    RETURN NEW;
END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_labeler_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_labeler_results (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    task_id bigint NOT NULL,
    document_id bigint NOT NULL,
    provider character varying(30) NOT NULL,
    model character varying(120) NOT NULL,
    indicator_name character varying(150) NOT NULL,
    indicator_value text,
    unit character varying(30),
    source_page integer NOT NULL,
    source_label text,
    confidence numeric(5,4),
    created_by bigint NOT NULL,
    created_by_username character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_bbox jsonb,
    CONSTRAINT ai_labeler_results_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT ai_labeler_results_provider_check CHECK (((provider)::text = ANY ((ARRAY['Gemini'::character varying, 'Groq'::character varying, 'ChatGPT'::character varying, 'Claude'::character varying])::text[]))),
    CONSTRAINT ai_labeler_results_source_page_check CHECK ((source_page > 0)),
    CONSTRAINT ck_ai_results_source_bbox CHECK (((source_bbox IS NULL) OR (jsonb_typeof(source_bbox) = 'object'::text)))
);


--
-- Name: ai_labeler_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_labeler_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_labeler_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_labeler_results_id_seq OWNED BY public.ai_labeler_results.id;


--
-- Name: annotation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annotation_sessions (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    session_type character varying(30) NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    due_at timestamp without time zone NOT NULL
);


--
-- Name: annotation_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.annotation_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: annotation_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.annotation_sessions_id_seq OWNED BY public.annotation_sessions.id;


--
-- Name: annotation_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annotation_tasks (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    session_id bigint,
    task_type character varying(30) NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    assigned_to bigint,
    assigned_by bigint NOT NULL,
    due_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp without time zone,
    assistance_mode character varying(20) DEFAULT 'NONE'::character varying NOT NULL,
    CONSTRAINT ck_annotation_tasks_assistance_mode CHECK (((assistance_mode)::text = ANY ((ARRAY['NONE'::character varying, 'AI_ASSISTED'::character varying])::text[])))
);


--
-- Name: annotation_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.annotation_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: annotation_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.annotation_tasks_id_seq OWNED BY public.annotation_tasks.id;


--
-- Name: annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annotations (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    label_name character varying(150) NOT NULL,
    label_value text,
    confidence numeric(5,4),
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_page integer,
    source_bbox jsonb,
    CONSTRAINT annotations_source_page_check CHECK (((source_page IS NULL) OR (source_page > 0))),
    CONSTRAINT ck_annotations_source_bbox CHECK (((source_bbox IS NULL) OR (jsonb_typeof(source_bbox) = 'object'::text)))
);


--
-- Name: annotations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.annotations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: annotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.annotations_id_seq OWNED BY public.annotations.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_id bigint,
    action character varying(100) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_id bigint,
    detail text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id bigint NOT NULL,
    title character varying(200) NOT NULL,
    original_name character varying(255) NOT NULL,
    storage_path character varying(500),
    document_type character varying(30),
    status character varying(30) DEFAULT 'NEW'::character varying NOT NULL,
    uploaded_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    file_data bytea,
    file_size bigint,
    content_type character varying(100)
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: manual_labeler_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_labeler_results (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    task_id bigint NOT NULL,
    document_id bigint NOT NULL,
    provider character varying(30) NOT NULL,
    model character varying(120) NOT NULL,
    indicator_name character varying(150) NOT NULL,
    indicator_value text,
    unit character varying(30),
    source_page integer NOT NULL,
    source_label text,
    confidence numeric(5,4),
    created_by bigint NOT NULL,
    created_by_username character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_bbox jsonb,
    CONSTRAINT ck_manual_results_source_bbox CHECK (((source_bbox IS NULL) OR (jsonb_typeof(source_bbox) = 'object'::text))),
    CONSTRAINT manual_labeler_results_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT manual_labeler_results_provider_check CHECK (((provider)::text = ANY ((ARRAY['Gemini'::character varying, 'Groq'::character varying, 'ChatGPT'::character varying, 'Claude'::character varying])::text[]))),
    CONSTRAINT manual_labeler_results_source_page_check CHECK ((source_page > 0))
);


--
-- Name: manual_labeler_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.manual_labeler_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: manual_labeler_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.manual_labeler_results_id_seq OWNED BY public.manual_labeler_results.id;


--
-- Name: prompt_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prompt_templates (
    id bigint NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    content text NOT NULL,
    model character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: prompt_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prompt_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prompt_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prompt_templates_id_seq OWNED BY public.prompt_templates.id;


--
-- Name: result_analysis_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.result_analysis_actions (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    field_key character varying(150) NOT NULL,
    note text,
    redo_run_id uuid,
    redo_confirmed boolean DEFAULT false NOT NULL,
    updated_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT result_analysis_actions_check CHECK (((note IS NOT NULL) OR redo_confirmed))
);


--
-- Name: result_analysis_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.result_analysis_actions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: result_analysis_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.result_analysis_actions_id_seq OWNED BY public.result_analysis_actions.id;


--
-- Name: result_analysis_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.result_analysis_completions (
    task_id bigint NOT NULL,
    completed_by bigint NOT NULL,
    completed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: review_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_cases (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    left_task_id bigint NOT NULL,
    right_task_id bigint NOT NULL,
    assigned_to bigint NOT NULL,
    created_by bigint NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    due_at timestamp without time zone NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_review_cases_dates CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT ck_review_cases_different_tasks CHECK ((left_task_id <> right_task_id)),
    CONSTRAINT review_cases_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying])::text[])))
);


--
-- Name: review_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_cases_id_seq OWNED BY public.review_cases.id;


--
-- Name: review_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_decisions (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    decision character varying(30) NOT NULL,
    feedback text,
    reviewed_by bigint NOT NULL,
    reviewed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: review_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_decisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_decisions_id_seq OWNED BY public.review_decisions.id;


--
-- Name: review_field_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_field_decisions (
    id bigint NOT NULL,
    review_case_id bigint NOT NULL,
    field_key character varying(150) NOT NULL,
    field_name character varying(150) NOT NULL,
    comparison_type character varying(30) NOT NULL,
    left_value text,
    right_value text,
    left_source_page integer,
    right_source_page integer,
    left_source_bbox jsonb,
    right_source_bbox jsonb,
    final_value text,
    selected_source character varying(20),
    feedback text,
    reviewed_by bigint,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_review_left_bbox CHECK (((left_source_bbox IS NULL) OR (jsonb_typeof(left_source_bbox) = 'object'::text))),
    CONSTRAINT ck_review_right_bbox CHECK (((right_source_bbox IS NULL) OR (jsonb_typeof(right_source_bbox) = 'object'::text))),
    CONSTRAINT review_field_decisions_comparison_type_check CHECK (((comparison_type)::text = ANY ((ARRAY['EXACT'::character varying, 'FORMAT_ONLY'::character varying, 'VALUE_DIFFERENT'::character varying, 'MISSING'::character varying])::text[]))),
    CONSTRAINT review_field_decisions_left_source_page_check CHECK (((left_source_page IS NULL) OR (left_source_page > 0))),
    CONSTRAINT review_field_decisions_right_source_page_check CHECK (((right_source_page IS NULL) OR (right_source_page > 0))),
    CONSTRAINT review_field_decisions_selected_source_check CHECK (((selected_source IS NULL) OR ((selected_source)::text = ANY ((ARRAY['LEFT'::character varying, 'RIGHT'::character varying, 'CUSTOM'::character varying])::text[]))))
);


--
-- Name: review_field_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_field_decisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_field_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_field_decisions_id_seq OWNED BY public.review_field_decisions.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role character varying(20) NOT NULL,
    feature character varying(40) NOT NULL,
    action character varying(20) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_by bigint,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_role_permissions_action CHECK (((action)::text = ANY ((ARRAY['READ'::character varying, 'WRITE'::character varying, 'EXECUTE'::character varying, 'DELETE'::character varying])::text[]))),
    CONSTRAINT ck_role_permissions_feature CHECK (((feature)::text = ANY ((ARRAY['DASHBOARD'::character varying, 'USER_MANAGEMENT'::character varying, 'PERMISSION_MANAGEMENT'::character varying, 'AUDIT_LOGS'::character varying, 'DOCUMENTS'::character varying, 'SESSIONS'::character varying, 'TASKS'::character varying, 'STATISTICS'::character varying])::text[]))),
    CONSTRAINT ck_role_permissions_role CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'MANAGER'::character varying])::text[])))
);


--
-- Name: session_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_members (
    session_id bigint NOT NULL,
    user_id bigint NOT NULL
);


--
-- Name: task_section_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_section_progress (
    id bigint NOT NULL,
    task_id bigint NOT NULL,
    field_key character varying(150) NOT NULL,
    field_name character varying(150) NOT NULL,
    status character varying(30) DEFAULT 'NOT_STARTED'::character varying NOT NULL,
    started_at timestamp without time zone,
    saved_at timestamp without time zone,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT task_section_progress_status_check CHECK (((status)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'IN_PROGRESS'::character varying, 'SAVED'::character varying, 'SUBMITTED'::character varying, 'REVIEWED'::character varying])::text[])))
);


--
-- Name: task_section_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_section_progress_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_section_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_section_progress_id_seq OWNED BY public.task_section_progress.id;


--
-- Name: terminology_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terminology_entries (
    id bigint NOT NULL,
    term character varying(200) NOT NULL,
    definition text NOT NULL,
    category character varying(100),
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: terminology_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.terminology_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: terminology_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.terminology_entries_id_seq OWNED BY public.terminology_entries.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(50) DEFAULT 'SYSTEM'::character varying NOT NULL,
    email character varying(254),
    CONSTRAINT ck_users_role CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'MANAGER'::character varying, 'AI_LABELER'::character varying, 'MANUAL_LABELER'::character varying, 'REVIEWER'::character varying, 'RESULT_ANALYST'::character varying, 'TERMINOLOGY'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: work_time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_time_entries (
    id bigint NOT NULL,
    task_id bigint,
    review_case_id bigint,
    user_id bigint NOT NULL,
    role_snapshot character varying(30) NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_heartbeat_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp without time zone,
    active_seconds bigint DEFAULT 0 NOT NULL,
    stop_reason character varying(30),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_work_time_dates CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT ck_work_time_single_target CHECK ((((task_id IS NOT NULL) AND (review_case_id IS NULL)) OR ((task_id IS NULL) AND (review_case_id IS NOT NULL)))),
    CONSTRAINT work_time_entries_active_seconds_check CHECK ((active_seconds >= 0)),
    CONSTRAINT work_time_entries_role_snapshot_check CHECK (((role_snapshot)::text = ANY ((ARRAY['AI_LABELER'::character varying, 'MANUAL_LABELER'::character varying, 'REVIEWER'::character varying])::text[]))),
    CONSTRAINT work_time_entries_stop_reason_check CHECK (((stop_reason IS NULL) OR ((stop_reason)::text = ANY ((ARRAY['SAVE'::character varying, 'SUBMIT'::character varying, 'COMPLETE'::character varying, 'PAGE_HIDDEN'::character varying, 'IDLE'::character varying, 'MANUAL'::character varying, 'STALE'::character varying])::text[]))))
);


--
-- Name: work_time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_time_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_time_entries_id_seq OWNED BY public.work_time_entries.id;


--
-- Name: ai_labeler_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_labeler_results ALTER COLUMN id SET DEFAULT nextval('public.ai_labeler_results_id_seq'::regclass);


--
-- Name: annotation_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_sessions ALTER COLUMN id SET DEFAULT nextval('public.annotation_sessions_id_seq'::regclass);


--
-- Name: annotation_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_tasks ALTER COLUMN id SET DEFAULT nextval('public.annotation_tasks_id_seq'::regclass);


--
-- Name: annotations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotations ALTER COLUMN id SET DEFAULT nextval('public.annotations_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: manual_labeler_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_labeler_results ALTER COLUMN id SET DEFAULT nextval('public.manual_labeler_results_id_seq'::regclass);


--
-- Name: prompt_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_templates ALTER COLUMN id SET DEFAULT nextval('public.prompt_templates_id_seq'::regclass);


--
-- Name: result_analysis_actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_actions ALTER COLUMN id SET DEFAULT nextval('public.result_analysis_actions_id_seq'::regclass);


--
-- Name: review_cases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases ALTER COLUMN id SET DEFAULT nextval('public.review_cases_id_seq'::regclass);


--
-- Name: review_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_decisions ALTER COLUMN id SET DEFAULT nextval('public.review_decisions_id_seq'::regclass);


--
-- Name: review_field_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_field_decisions ALTER COLUMN id SET DEFAULT nextval('public.review_field_decisions_id_seq'::regclass);


--
-- Name: task_section_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_section_progress ALTER COLUMN id SET DEFAULT nextval('public.task_section_progress_id_seq'::regclass);


--
-- Name: terminology_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terminology_entries ALTER COLUMN id SET DEFAULT nextval('public.terminology_entries_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: work_time_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_time_entries ALTER COLUMN id SET DEFAULT nextval('public.work_time_entries_id_seq'::regclass);


--
-- Name: ai_labeler_results ai_labeler_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_labeler_results
    ADD CONSTRAINT ai_labeler_results_pkey PRIMARY KEY (id);


--
-- Name: annotation_sessions annotation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_sessions
    ADD CONSTRAINT annotation_sessions_pkey PRIMARY KEY (id);


--
-- Name: annotation_tasks annotation_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_tasks
    ADD CONSTRAINT annotation_tasks_pkey PRIMARY KEY (id);


--
-- Name: annotations annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotations
    ADD CONSTRAINT annotations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: manual_labeler_results manual_labeler_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_labeler_results
    ADD CONSTRAINT manual_labeler_results_pkey PRIMARY KEY (id);


--
-- Name: role_permissions pk_role_permissions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT pk_role_permissions PRIMARY KEY (role, feature, action);


--
-- Name: prompt_templates prompt_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_templates
    ADD CONSTRAINT prompt_templates_pkey PRIMARY KEY (id);


--
-- Name: result_analysis_actions result_analysis_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_actions
    ADD CONSTRAINT result_analysis_actions_pkey PRIMARY KEY (id);


--
-- Name: result_analysis_actions result_analysis_actions_task_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_actions
    ADD CONSTRAINT result_analysis_actions_task_id_field_key_key UNIQUE (task_id, field_key);


--
-- Name: result_analysis_completions result_analysis_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_completions
    ADD CONSTRAINT result_analysis_completions_pkey PRIMARY KEY (task_id);


--
-- Name: review_cases review_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases
    ADD CONSTRAINT review_cases_pkey PRIMARY KEY (id);


--
-- Name: review_decisions review_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_decisions
    ADD CONSTRAINT review_decisions_pkey PRIMARY KEY (id);


--
-- Name: review_decisions review_decisions_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_decisions
    ADD CONSTRAINT review_decisions_task_id_key UNIQUE (task_id);


--
-- Name: review_field_decisions review_field_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_field_decisions
    ADD CONSTRAINT review_field_decisions_pkey PRIMARY KEY (id);


--
-- Name: session_members session_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_members
    ADD CONSTRAINT session_members_pkey PRIMARY KEY (session_id, user_id);


--
-- Name: task_section_progress task_section_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_section_progress
    ADD CONSTRAINT task_section_progress_pkey PRIMARY KEY (id);


--
-- Name: terminology_entries terminology_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terminology_entries
    ADD CONSTRAINT terminology_entries_pkey PRIMARY KEY (id);


--
-- Name: terminology_entries terminology_entries_term_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terminology_entries
    ADD CONSTRAINT terminology_entries_term_key UNIQUE (term);


--
-- Name: users uk_users_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk_users_username UNIQUE (username);


--
-- Name: review_field_decisions uq_review_field_decision; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_field_decisions
    ADD CONSTRAINT uq_review_field_decision UNIQUE (review_case_id, field_key);


--
-- Name: task_section_progress uq_task_section_progress; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_section_progress
    ADD CONSTRAINT uq_task_section_progress UNIQUE (task_id, field_key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_time_entries work_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_time_entries
    ADD CONSTRAINT work_time_entries_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_results_created_by_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_results_created_by_username ON public.ai_labeler_results USING btree (created_by_username);


--
-- Name: idx_ai_results_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_results_run_id ON public.ai_labeler_results USING btree (run_id);


--
-- Name: idx_ai_results_task_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_results_task_created_at ON public.ai_labeler_results USING btree (task_id, created_at DESC);


--
-- Name: idx_annotations_task_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_annotations_task_label ON public.annotations USING btree (task_id, label_name);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_status ON public.documents USING btree (status);


--
-- Name: idx_documents_uploaded_by_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_uploaded_by_created_at ON public.documents USING btree (uploaded_by, created_at DESC);


--
-- Name: idx_manual_results_created_by_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_results_created_by_username ON public.manual_labeler_results USING btree (created_by_username);


--
-- Name: idx_manual_results_task_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_results_task_created ON public.manual_labeler_results USING btree (task_id, created_at DESC);


--
-- Name: idx_result_analysis_actions_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_result_analysis_actions_task ON public.result_analysis_actions USING btree (task_id);


--
-- Name: idx_review_cases_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_cases_document ON public.review_cases USING btree (document_id);


--
-- Name: idx_review_cases_reviewer_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_cases_reviewer_status_due ON public.review_cases USING btree (assigned_to, status, due_at);


--
-- Name: idx_review_fields_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_fields_case ON public.review_field_decisions USING btree (review_case_id);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role);


--
-- Name: idx_section_field_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_section_field_status ON public.task_section_progress USING btree (field_key, status);


--
-- Name: idx_section_task_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_section_task_status ON public.task_section_progress USING btree (task_id, status);


--
-- Name: idx_sessions_created_by_due_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_created_by_due_at ON public.annotation_sessions USING btree (created_by, due_at);


--
-- Name: idx_tasks_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assigned_to ON public.annotation_tasks USING btree (assigned_to);


--
-- Name: idx_tasks_assistance_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assistance_mode ON public.annotation_tasks USING btree (assistance_mode, status);


--
-- Name: idx_tasks_session_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_session_status_due ON public.annotation_tasks USING btree (session_id, status, due_at);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.annotation_tasks USING btree (status);


--
-- Name: idx_terminology_entries_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terminology_entries_category ON public.terminology_entries USING btree (category);


--
-- Name: idx_terminology_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_terminology_entries_status ON public.terminology_entries USING btree (status);


--
-- Name: idx_work_time_review_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_time_review_case ON public.work_time_entries USING btree (review_case_id);


--
-- Name: idx_work_time_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_time_task ON public.work_time_entries USING btree (task_id);


--
-- Name: idx_work_time_user_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_time_user_started ON public.work_time_entries USING btree (user_id, started_at);


--
-- Name: uk_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_users_email_lower ON public.users USING btree (lower((email)::text)) WHERE (email IS NOT NULL);


--
-- Name: uk_users_username_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uk_users_username_lower ON public.users USING btree (lower((username)::text));


--
-- Name: uq_review_cases_active_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_review_cases_active_pair ON public.review_cases USING btree (LEAST(left_task_id, right_task_id), GREATEST(left_task_id, right_task_id)) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying])::text[]));


--
-- Name: uq_work_time_active_review_case; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_work_time_active_review_case ON public.work_time_entries USING btree (user_id, review_case_id) WHERE ((ended_at IS NULL) AND (review_case_id IS NOT NULL));


--
-- Name: uq_work_time_active_task; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_work_time_active_task ON public.work_time_entries USING btree (user_id, task_id) WHERE ((ended_at IS NULL) AND (task_id IS NOT NULL));


--
-- Name: review_cases trg_review_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_review_cases_updated_at BEFORE UPDATE ON public.review_cases FOR EACH ROW EXECUTE FUNCTION public.aair_set_updated_at();


--
-- Name: review_field_decisions trg_review_fields_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_review_fields_updated_at BEFORE UPDATE ON public.review_field_decisions FOR EACH ROW EXECUTE FUNCTION public.aair_set_updated_at();


--
-- Name: task_section_progress trg_task_section_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_task_section_updated_at BEFORE UPDATE ON public.task_section_progress FOR EACH ROW EXECUTE FUNCTION public.aair_set_updated_at();


--
-- Name: review_cases trg_validate_review_case; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_review_case BEFORE INSERT OR UPDATE OF document_id, left_task_id, right_task_id, assigned_to, created_by ON public.review_cases FOR EACH ROW EXECUTE FUNCTION public.validate_review_case();


--
-- Name: work_time_entries trg_work_time_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_work_time_updated_at BEFORE UPDATE ON public.work_time_entries FOR EACH ROW EXECUTE FUNCTION public.aair_set_updated_at();


--
-- Name: ai_labeler_results ai_labeler_results_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_labeler_results
    ADD CONSTRAINT ai_labeler_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ai_labeler_results ai_labeler_results_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_labeler_results
    ADD CONSTRAINT ai_labeler_results_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: ai_labeler_results ai_labeler_results_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_labeler_results
    ADD CONSTRAINT ai_labeler_results_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: annotation_sessions annotation_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_sessions
    ADD CONSTRAINT annotation_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: annotation_tasks annotation_tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_tasks
    ADD CONSTRAINT annotation_tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: annotation_tasks annotation_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_tasks
    ADD CONSTRAINT annotation_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: annotation_tasks annotation_tasks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_tasks
    ADD CONSTRAINT annotation_tasks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: annotation_tasks annotation_tasks_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotation_tasks
    ADD CONSTRAINT annotation_tasks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.annotation_sessions(id);


--
-- Name: annotations annotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotations
    ADD CONSTRAINT annotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: annotations annotations_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annotations
    ADD CONSTRAINT annotations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: manual_labeler_results manual_labeler_results_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_labeler_results
    ADD CONSTRAINT manual_labeler_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: manual_labeler_results manual_labeler_results_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_labeler_results
    ADD CONSTRAINT manual_labeler_results_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: manual_labeler_results manual_labeler_results_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_labeler_results
    ADD CONSTRAINT manual_labeler_results_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: prompt_templates prompt_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prompt_templates
    ADD CONSTRAINT prompt_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: result_analysis_actions result_analysis_actions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_actions
    ADD CONSTRAINT result_analysis_actions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: result_analysis_actions result_analysis_actions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_actions
    ADD CONSTRAINT result_analysis_actions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: result_analysis_completions result_analysis_completions_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_completions
    ADD CONSTRAINT result_analysis_completions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: result_analysis_completions result_analysis_completions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.result_analysis_completions
    ADD CONSTRAINT result_analysis_completions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: review_cases review_cases_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases
    ADD CONSTRAINT review_cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: review_cases review_cases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases
    ADD CONSTRAINT review_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: review_cases review_cases_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases
    ADD CONSTRAINT review_cases_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: review_cases review_cases_left_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases
    ADD CONSTRAINT review_cases_left_task_id_fkey FOREIGN KEY (left_task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: review_cases review_cases_right_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_cases
    ADD CONSTRAINT review_cases_right_task_id_fkey FOREIGN KEY (right_task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: review_decisions review_decisions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_decisions
    ADD CONSTRAINT review_decisions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: review_decisions review_decisions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_decisions
    ADD CONSTRAINT review_decisions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: review_field_decisions review_field_decisions_review_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_field_decisions
    ADD CONSTRAINT review_field_decisions_review_case_id_fkey FOREIGN KEY (review_case_id) REFERENCES public.review_cases(id) ON DELETE CASCADE;


--
-- Name: review_field_decisions review_field_decisions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_field_decisions
    ADD CONSTRAINT review_field_decisions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: role_permissions role_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: session_members session_members_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_members
    ADD CONSTRAINT session_members_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.annotation_sessions(id) ON DELETE CASCADE;


--
-- Name: session_members session_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_members
    ADD CONSTRAINT session_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_section_progress task_section_progress_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_section_progress
    ADD CONSTRAINT task_section_progress_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: terminology_entries terminology_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terminology_entries
    ADD CONSTRAINT terminology_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: work_time_entries work_time_entries_review_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_time_entries
    ADD CONSTRAINT work_time_entries_review_case_id_fkey FOREIGN KEY (review_case_id) REFERENCES public.review_cases(id) ON DELETE CASCADE;


--
-- Name: work_time_entries work_time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_time_entries
    ADD CONSTRAINT work_time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.annotation_tasks(id) ON DELETE CASCADE;


--
-- Name: work_time_entries work_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_time_entries
    ADD CONSTRAINT work_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Default permission matrix required by the ADMIN and MANAGER APIs.
WITH role_list(role) AS (
    VALUES ('ADMIN'), ('MANAGER')
),
feature_list(feature) AS (
    VALUES
        ('DASHBOARD'),
        ('USER_MANAGEMENT'),
        ('PERMISSION_MANAGEMENT'),
        ('AUDIT_LOGS'),
        ('DOCUMENTS'),
        ('SESSIONS'),
        ('TASKS'),
        ('STATISTICS')
),
action_list(action) AS (
    VALUES ('READ'), ('WRITE'), ('EXECUTE'), ('DELETE')
)
INSERT INTO public.role_permissions (role, feature, action, enabled)
SELECT r.role,
       f.feature,
       a.action,
       CASE
           WHEN r.role = 'ADMIN' AND (
               (f.feature = 'DASHBOARD' AND a.action = 'READ') OR
               (f.feature = 'USER_MANAGEMENT' AND a.action IN ('READ', 'WRITE')) OR
               (f.feature = 'PERMISSION_MANAGEMENT' AND a.action IN ('READ', 'WRITE')) OR
               (f.feature = 'AUDIT_LOGS' AND a.action = 'READ')
           ) THEN TRUE
           WHEN r.role = 'MANAGER' AND (
               (f.feature = 'DASHBOARD' AND a.action = 'READ') OR
               (f.feature = 'USER_MANAGEMENT' AND a.action IN ('READ', 'WRITE')) OR
               (f.feature = 'PERMISSION_MANAGEMENT' AND a.action = 'READ') OR
               (f.feature = 'DOCUMENTS' AND a.action IN ('READ', 'WRITE', 'DELETE')) OR
               (f.feature = 'SESSIONS' AND a.action IN ('READ', 'WRITE', 'EXECUTE')) OR
               (f.feature = 'TASKS' AND a.action IN ('READ', 'WRITE', 'EXECUTE')) OR
               (f.feature = 'STATISTICS' AND a.action = 'READ')
           ) THEN TRUE
           ELSE FALSE
       END
FROM role_list r
CROSS JOIN feature_list f
CROSS JOIN action_list a
ON CONFLICT (role, feature, action) DO NOTHING;

COMMIT;

-- Verification: expected result is 19 tables.
SELECT tablename
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

