-- Enforce active-profile status inside student assessment RPCs.
-- Dashboard middleware is not an authorization boundary: RPC calls can be made directly.

CREATE OR REPLACE FUNCTION public.start_academic_assessment_attempt(p_assessment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    uid uuid := (SELECT auth.uid());
    exam public.academic_assessments%ROWTYPE;
    enr public.course_enrollments%ROWTYPE;
    attempt public.academic_assessment_attempts%ROWTYPE;
    next_number integer;
    expired_current boolean := false;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- A suspended or missing profile must not start new academic activity.
    PERFORM 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.status = 'active'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'An active profile is required';
    END IF;

    SELECT *
    INTO exam
    FROM public.academic_assessments
    WHERE id = p_assessment_id
      AND status = 'published'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Published assessment not found';
    END IF;

    SELECT *
    INTO enr
    FROM public.course_enrollments
    WHERE user_id = uid
      AND course_id = exam.course_id
      AND district_id = exam.district_id
      AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'An active course enrollment is required';
    END IF;

    IF exam.assessment_type = 'final'
       AND EXISTS (
           SELECT 1
           FROM public.lessons l
           JOIN public.course_modules cm ON cm.id = l.module_id
           LEFT JOIN public.lesson_progress lp
             ON lp.lesson_id = l.id
            AND lp.enrollment_id = enr.id
           WHERE cm.course_id = exam.course_id
             AND l.district_id = exam.district_id
             AND cm.status = 'published'
             AND l.status = 'published'
             AND (lp.id IS NULL OR lp.status <> 'completed')
       ) THEN
        RAISE EXCEPTION 'Complete all published lessons before taking the final assessment';
    END IF;

    SELECT *
    INTO attempt
    FROM public.academic_assessment_attempts
    WHERE assessment_id = p_assessment_id
      AND enrollment_id = enr.id
      AND status = 'in_progress'
    FOR UPDATE;

    IF FOUND THEN
        IF attempt.expires_at IS NOT NULL
           AND attempt.expires_at <= now() THEN
            UPDATE public.academic_assessment_attempts
            SET status = 'expired'
            WHERE id = attempt.id;
            expired_current := true;
        ELSE
            RETURN jsonb_build_object(
                'attempt_id', attempt.id,
                'attempt_number', attempt.attempt_number,
                'started_at', attempt.started_at,
                'expires_at', attempt.expires_at
            );
        END IF;
    END IF;

    SELECT coalesce(max(attempt_number), 0) + 1
    INTO next_number
    FROM public.academic_assessment_attempts
    WHERE assessment_id = p_assessment_id
      AND enrollment_id = enr.id;

    IF exam.max_attempts IS NOT NULL
       AND next_number > exam.max_attempts THEN
        IF expired_current THEN
            RETURN jsonb_build_object(
                'status', 'max_attempts_reached',
                'attempt_number', attempt.attempt_number
            );
        END IF;
        RAISE EXCEPTION 'Maximum attempts reached';
    END IF;

    INSERT INTO public.academic_assessment_attempts (
        assessment_id,
        enrollment_id,
        district_id,
        user_id,
        attempt_number,
        total_possible,
        status,
        started_at,
        expires_at
    )
    VALUES (
        p_assessment_id,
        enr.id,
        exam.district_id,
        uid,
        next_number,
        1,
        'in_progress',
        now(),
        CASE
            WHEN exam.time_limit_minutes IS NULL THEN NULL
            ELSE now() + make_interval(mins => exam.time_limit_minutes)
        END
    )
    RETURNING * INTO attempt;

    RETURN jsonb_build_object(
        'attempt_id', attempt.id,
        'attempt_number', attempt.attempt_number,
        'started_at', attempt.started_at,
        'expires_at', attempt.expires_at
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_academic_assessment(
    p_attempt_id uuid,
    p_answers jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    uid uuid := (SELECT auth.uid());
    attempt public.academic_assessment_attempts%ROWTYPE;
    exam public.academic_assessments%ROWTYPE;
    enr public.course_enrollments%ROWTYPE;
    q record;
    ans jsonb;
    key_value jsonb;
    correct boolean;
    earned numeric(8,2) := 0;
    possible numeric(8,2) := 0;
    pending integer := 0;
    score numeric(5,2);
    did_pass boolean;
    total integer;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF jsonb_typeof(p_answers) <> 'object' THEN
        RAISE EXCEPTION 'Answers must be a JSON object';
    END IF;

    -- Check suspension before changing an attempt or recording responses.
    PERFORM 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.status = 'active'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'An active profile is required';
    END IF;

    SELECT *
    INTO attempt
    FROM public.academic_assessment_attempts
    WHERE id = p_attempt_id
      AND user_id = uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment attempt not found';
    END IF;

    IF attempt.status <> 'in_progress' THEN
        RAISE EXCEPTION 'This assessment attempt is no longer active';
    END IF;

    IF attempt.expires_at IS NOT NULL
       AND attempt.expires_at <= now() THEN
        UPDATE public.academic_assessment_attempts
        SET status = 'expired'
        WHERE id = attempt.id;

        RETURN jsonb_build_object(
            'attempt_id', attempt.id,
            'attempt_number', attempt.attempt_number,
            'status', 'expired',
            'objective_earned', 0,
            'total_possible', 0,
            'manual_pending', 0,
            'score_percent', NULL,
            'passed', NULL
        );
    END IF;

    SELECT *
    INTO exam
    FROM public.academic_assessments
    WHERE id = attempt.assessment_id
      AND status = 'published';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Published assessment not found';
    END IF;

    SELECT *
    INTO enr
    FROM public.course_enrollments
    WHERE id = attempt.enrollment_id
      AND user_id = uid
      AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'An active course enrollment is required';
    END IF;

    SELECT count(*)
    INTO total
    FROM public.academic_assessment_questions
    WHERE assessment_id = exam.id;

    IF total = 0 THEN
        RAISE EXCEPTION 'Assessment has no questions';
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> total THEN
        RAISE EXCEPTION 'Answers must contain exactly one entry for every question';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_answers) k(question_id)
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.academic_assessment_questions q
            WHERE q.assessment_id = exam.id
              AND q.id::text = k.question_id
        )
    ) THEN
        RAISE EXCEPTION 'Answers contain unknown question identifiers';
    END IF;

    FOR q IN
        SELECT *
        FROM public.academic_assessment_questions
        WHERE assessment_id = exam.id
        ORDER BY sort_order
    LOOP
        ans := p_answers -> q.id::text;

        SELECT answer_key
        INTO key_value
        FROM private.academic_assessment_answer_keys
        WHERE question_id = q.id;

        IF key_value IS NULL THEN
            RAISE EXCEPTION 'Question is missing an answer key';
        END IF;

        IF q.question_type IN ('single_choice', 'true_false') THEN
            IF jsonb_typeof(ans) <> 'string'
               OR NOT EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements_text(q.options) o(value)
                   WHERE o.value = ans #>> '{}'
               ) THEN
                RAISE EXCEPTION 'Invalid answer option for question %', q.id;
            END IF;

            correct := ans = key_value;
            possible := possible + q.points;
            IF correct THEN
                earned := earned + q.points;
            END IF;

            INSERT INTO public.academic_assessment_responses (
                attempt_id, question_id, answer, is_correct, awarded_points
            )
            VALUES (
                attempt.id, q.id, ans, correct,
                CASE WHEN correct THEN q.points ELSE 0 END
            );

        ELSIF q.question_type = 'multiple_choice' THEN
            IF jsonb_typeof(ans) <> 'array'
               OR jsonb_array_length(ans) = 0
               OR EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements(ans) v
                   WHERE jsonb_typeof(v) <> 'string'
               )
               OR (
                   SELECT count(*)
                   FROM jsonb_array_elements_text(ans)
               ) <> (
                   SELECT count(DISTINCT value)
                   FROM jsonb_array_elements_text(ans) x(value)
               )
               OR EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements_text(ans) v(value)
                   WHERE NOT EXISTS (
                       SELECT 1
                       FROM jsonb_array_elements_text(q.options) o(value)
                       WHERE o.value = v.value
                   )
               ) THEN
                RAISE EXCEPTION 'Invalid multiple-choice answer for question %', q.id;
            END IF;

            SELECT coalesce(jsonb_agg(value ORDER BY value), '[]'::jsonb)
            INTO ans
            FROM jsonb_array_elements_text(ans) x(value);

            correct := ans = (
                SELECT coalesce(jsonb_agg(value ORDER BY value), '[]'::jsonb)
                FROM jsonb_array_elements_text(key_value) x(value)
            );

            possible := possible + q.points;
            IF correct THEN
                earned := earned + q.points;
            END IF;

            INSERT INTO public.academic_assessment_responses (
                attempt_id, question_id, answer, is_correct, awarded_points
            )
            VALUES (
                attempt.id, q.id, ans, correct,
                CASE WHEN correct THEN q.points ELSE 0 END
            );

        ELSIF q.question_type = 'short_answer' THEN
            IF jsonb_typeof(ans) <> 'string'
               OR length(trim(ans #>> '{}')) = 0
               OR length(ans #>> '{}') > 4000 THEN
                RAISE EXCEPTION 'Invalid short answer for question %', q.id;
            END IF;

            pending := pending + 1;

            INSERT INTO public.academic_assessment_responses (
                attempt_id, question_id, answer
            )
            VALUES (attempt.id, q.id, ans);

        ELSE
            RAISE EXCEPTION 'Unsupported question type';
        END IF;
    END LOOP;

    SELECT coalesce(sum(points), 0)
    INTO possible
    FROM public.academic_assessment_questions
    WHERE assessment_id = exam.id;

    IF pending > 0 THEN
        UPDATE public.academic_assessment_attempts
        SET
            status = 'review_pending',
            objective_earned = earned,
            total_possible = possible,
            manual_pending = pending,
            submitted_at = now()
        WHERE id = attempt.id;
    ELSE
        score := round((earned / nullif(possible, 0)) * 100, 2);
        did_pass := score >= exam.passing_score;

        UPDATE public.academic_assessment_attempts
        SET
            status = 'graded',
            objective_earned = earned,
            total_possible = possible,
            manual_pending = 0,
            score_percent = score,
            passed = did_pass,
            graded_at = now(),
            submitted_at = now()
        WHERE id = attempt.id;

        IF exam.assessment_type = 'final' AND did_pass THEN
            PERFORM private.complete_course_and_unlock_next(enr.id);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'attempt_id', attempt.id,
        'attempt_number', attempt.attempt_number,
        'status', CASE WHEN pending > 0 THEN 'review_pending' ELSE 'graded' END,
        'objective_earned', earned,
        'total_possible', possible,
        'manual_pending', pending,
        'score_percent', score,
        'passed', did_pass
    );
END;
$function$;
