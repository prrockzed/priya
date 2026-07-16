CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`charter` text,
	`capabilities` text DEFAULT '[]' NOT NULL,
	`runner` text NOT NULL,
	`model` text NOT NULL,
	`parent_id` text
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`preview` text,
	`decided` text DEFAULT 'pending' NOT NULL,
	`decided_at` integer
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`agent_id` text NOT NULL,
	`period` text NOT NULL,
	`tokens_cap` integer,
	`usd_cap` real,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`usd_used` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`agent_id`, `period`)
);
--> statement-breakpoint
CREATE TABLE `memory_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`src_id` text NOT NULL,
	`dst_id` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`mtime` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metrics_rollup` (
	`day` text NOT NULL,
	`agent_id` text NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`tasks_done` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `agent_id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`vault_subdir` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`runner` text NOT NULL,
	`model` text NOT NULL,
	`transcript_path` text,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`tokens_cache` integer DEFAULT 0 NOT NULL,
	`cost_usd` real,
	`estimated` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`actor` text NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`goal_id` text,
	`parent_task_id` text,
	`title` text NOT NULL,
	`body` text,
	`state` text DEFAULT 'inbox' NOT NULL,
	`owner_agent_id` text,
	`created_by` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`approval_kind` text,
	`lock_token` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wakeups` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`reason` text NOT NULL,
	`coalesce_key` text
);
