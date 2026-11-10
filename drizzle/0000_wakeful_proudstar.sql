CREATE TABLE "autonomous_workflow_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"stage_name" text NOT NULL,
	"action_type" text NOT NULL,
	"target_entity_code" text NOT NULL,
	"selection_rationale" text NOT NULL,
	"outcome_summary" text NOT NULL,
	"scientific_disposition" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-1.0.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibration_benchmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_code" text NOT NULL,
	"test_name" text NOT NULL,
	"category" text NOT NULL,
	"injected_ground_truth" text NOT NULL,
	"sensitivity" double precision NOT NULL,
	"false_positive_rate" double precision NOT NULL,
	"precision_score" double precision NOT NULL,
	"recall_score" double precision NOT NULL,
	"detection_delay_steps" integer NOT NULL,
	"status" text NOT NULL,
	"notes" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-0.9.4' NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calibration_benchmarks_test_code_unique" UNIQUE("test_code")
);
--> statement-breakpoint
CREATE TABLE "claims_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_code" text NOT NULL,
	"programme_id" integer NOT NULL,
	"claim_text" text NOT NULL,
	"claim_type" text NOT NULL,
	"operational_definition" text NOT NULL,
	"supporting_run_ids" jsonb NOT NULL,
	"contradicting_run_ids" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"alternative_explanations" jsonb NOT NULL,
	"scope_conditions" text NOT NULL,
	"uncertainty" jsonb NOT NULL,
	"confidence_label" text NOT NULL,
	"validation_status" text DEFAULT 'candidate' NOT NULL,
	"independence_classification" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-0.9.4' NOT NULL,
	"human_override_approved" boolean DEFAULT false NOT NULL,
	"human_override_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claims_ledger_claim_code_unique" UNIQUE("claim_code")
);
--> statement-breakpoint
CREATE TABLE "counterfactual_interventions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"parent_run_id" integer NOT NULL,
	"counterfactual_run_id" integer,
	"question" text NOT NULL,
	"intervention_type" text NOT NULL,
	"target_spec" text NOT NULL,
	"parameter_delta" jsonb NOT NULL,
	"matched_seed" boolean DEFAULT true NOT NULL,
	"identification_status" text NOT NULL,
	"identification_rationale" text NOT NULL,
	"confounders" jsonb NOT NULL,
	"alternative_explanations" jsonb NOT NULL,
	"causal_dag" jsonb NOT NULL,
	"delta_coordination" double precision NOT NULL,
	"delta_order_parameter" double precision NOT NULL,
	"delta_transfer_entropy" double precision NOT NULL,
	"effect_size_d" double precision NOT NULL,
	"ci95_low" double precision NOT NULL,
	"ci95_high" double precision NOT NULL,
	"sensitivity_gamma_bound" double precision NOT NULL,
	"conclusion_label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "counterfactual_interventions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "discovery_search_archives" (
	"id" serial PRIMARY KEY NOT NULL,
	"archive_code" text NOT NULL,
	"environment_family" text NOT NULL,
	"search_objective" text NOT NULL,
	"descriptor_x" text NOT NULL,
	"descriptor_y" text NOT NULL,
	"grid_size" integer DEFAULT 5 NOT NULL,
	"total_evaluations" integer NOT NULL,
	"coverage_pct" double precision NOT NULL,
	"qd_score" double precision NOT NULL,
	"cells" jsonb NOT NULL,
	"blind_spots" text NOT NULL,
	"stopping_rule" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-1.0.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_search_archives_archive_code_unique" UNIQUE("archive_code")
);
--> statement-breakpoint
CREATE TABLE "experiment_designs" (
	"id" serial PRIMARY KEY NOT NULL,
	"programme_id" integer NOT NULL,
	"title" text NOT NULL,
	"analysis_mode" text DEFAULT 'confirmatory' NOT NULL,
	"primary_outcome" text NOT NULL,
	"secondary_outcomes" jsonb NOT NULL,
	"smallest_effect_interest" double precision NOT NULL,
	"pilot_variance_estimate" double precision NOT NULL,
	"power_target" double precision DEFAULT 0.8 NOT NULL,
	"planned_trials" integer NOT NULL,
	"estimated_power" double precision NOT NULL,
	"stopping_rule" text NOT NULL,
	"exclusion_criteria" text NOT NULL,
	"deviations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preregistration_hash" text NOT NULL,
	"approved_by_human" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_code" text NOT NULL,
	"programme_id" integer NOT NULL,
	"design_id" integer,
	"parent_run_id" integer,
	"intervention_id" integer,
	"title" text NOT NULL,
	"run_type" text NOT NULL,
	"environment_family" text NOT NULL,
	"seed" integer NOT NULL,
	"agent_count" integer NOT NULL,
	"steps" integer NOT NULL,
	"memory_policy" text NOT NULL,
	"comm_noise" double precision DEFAULT 0.05 NOT NULL,
	"comm_channel_enabled" boolean DEFAULT true NOT NULL,
	"coupling_strength" double precision DEFAULT 0.55 NOT NULL,
	"resource_budget" double precision DEFAULT 100 NOT NULL,
	"model_heterogeneity" text DEFAULT 'homogeneous_deterministic' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"failure_category" text,
	"failure_reason" text,
	"config_hash" text NOT NULL,
	"dataset_hash" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-0.9.4' NOT NULL,
	"mean_coordination" double precision NOT NULL,
	"final_order_parameter" double precision NOT NULL,
	"entropy_bits" double precision NOT NULL,
	"mutual_info_bits" double precision NOT NULL,
	"transfer_entropy_bits" double precision NOT NULL,
	"critical_slowing_lag1" double precision NOT NULL,
	"micro_macro_divergence" double precision NOT NULL,
	"anomaly_count" integer DEFAULT 0 NOT NULL,
	"statistical_power_observed" double precision NOT NULL,
	"data_quality" jsonb NOT NULL,
	"trajectory" jsonb NOT NULL,
	"final_agents" jsonb NOT NULL,
	"events" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_runs_run_code_unique" UNIQUE("run_code")
);
--> statement-breakpoint
CREATE TABLE "literature_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"lit_code" text NOT NULL,
	"title" text NOT NULL,
	"authors" text NOT NULL,
	"venue" text NOT NULL,
	"year" integer NOT NULL,
	"doi_or_id" text NOT NULL,
	"source_url" text NOT NULL,
	"peer_review_status" text NOT NULL,
	"access_status" text NOT NULL,
	"inspected_full_text" boolean DEFAULT false NOT NULL,
	"relation_to_programme" text NOT NULL,
	"related_programme_code" text NOT NULL,
	"key_claim_checked" text NOT NULL,
	"limitations_noted" text NOT NULL,
	"retrieved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "literature_records_lit_code_unique" UNIQUE("lit_code")
);
--> statement-breakpoint
CREATE TABLE "parameter_sweeps" (
	"id" serial PRIMARY KEY NOT NULL,
	"sweep_code" text NOT NULL,
	"environment_family" text NOT NULL,
	"sweep_mode" text NOT NULL,
	"x_param" text NOT NULL,
	"y_param" text NOT NULL,
	"grid_points" jsonb NOT NULL,
	"critical_transition_estimate" text NOT NULL,
	"hysteresis_gap" double precision DEFAULT 0 NOT NULL,
	"assumptions_warning" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-1.0.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parameter_sweeps_sweep_code_unique" UNIQUE("sweep_code")
);
--> statement-breakpoint
CREATE TABLE "provenance_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_code" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"rationale" text NOT NULL,
	"content_hash" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-0.9.4' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provenance_events_event_code_unique" UNIQUE("event_code")
);
--> statement-breakpoint
CREATE TABLE "red_team_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_id" integer NOT NULL,
	"reviewer_identity" text NOT NULL,
	"reviewer_role" text NOT NULL,
	"explanation_category" text NOT NULL,
	"severity" text NOT NULL,
	"objection_text" text NOT NULL,
	"evidence_ref" text NOT NULL,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"blind_review" boolean DEFAULT true NOT NULL,
	"shared_model_warning" boolean DEFAULT false NOT NULL,
	"resolution_note" text,
	"software_version" text DEFAULT 'omeil-os-0.9.4' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_programmes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"research_question" text NOT NULL,
	"operational_definition" text NOT NULL,
	"competing_hypotheses" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ethics_checklist_passed" boolean DEFAULT true NOT NULL,
	"limitations" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_programmes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "swarm_failure_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_code" text NOT NULL,
	"benchmark_task" text NOT NULL,
	"seed" integer NOT NULL,
	"entries" jsonb NOT NULL,
	"empirical_conclusion" text NOT NULL,
	"software_version" text DEFAULT 'omeil-os-1.0.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "swarm_failure_audits_audit_code_unique" UNIQUE("audit_code")
);
--> statement-breakpoint
CREATE TABLE "system_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"emergency_stop_active" boolean DEFAULT false NOT NULL,
	"swarm_paused" boolean DEFAULT false NOT NULL,
	"external_providers_disabled" boolean DEFAULT true NOT NULL,
	"literature_retrieval_disabled" boolean DEFAULT false NOT NULL,
	"max_concurrent_jobs" integer DEFAULT 2 NOT NULL,
	"max_agents_per_run" integer DEFAULT 48 NOT NULL,
	"max_steps_per_run" integer DEFAULT 180 NOT NULL,
	"active_capability_tier" text DEFAULT 'TIER 1 — CORE LOCAL LAB' NOT NULL,
	"autonomous_mode_enabled" boolean DEFAULT false NOT NULL,
	"autonomous_interval_sec" integer DEFAULT 5 NOT NULL,
	"autonomous_cycle_count" integer DEFAULT 0 NOT NULL,
	"max_autonomous_cycles" integer DEFAULT 40 NOT NULL,
	"last_autonomous_action" text,
	"last_stop_reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims_ledger" ADD CONSTRAINT "claims_ledger_programme_id_research_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."research_programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterfactual_interventions" ADD CONSTRAINT "counterfactual_interventions_parent_run_id_experiment_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."experiment_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterfactual_interventions" ADD CONSTRAINT "counterfactual_interventions_counterfactual_run_id_experiment_runs_id_fk" FOREIGN KEY ("counterfactual_run_id") REFERENCES "public"."experiment_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_designs" ADD CONSTRAINT "experiment_designs_programme_id_research_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."research_programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_programme_id_research_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."research_programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_design_id_experiment_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."experiment_designs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "red_team_reviews" ADD CONSTRAINT "red_team_reviews_claim_id_claims_ledger_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims_ledger"("id") ON DELETE cascade ON UPDATE no action;