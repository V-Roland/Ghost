"""Tests for the Ghost pipeline.

Run with:  python3 -m unittest discover -s tests -v

The integrity tests matter most: a detector that fires on ordinary human
speech is worse than no detector at all, so several of these assert that
nothing is flagged.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ghost import integrity, transcript  # noqa: E402
from ghost.ingest import parse_job_description, parse_portfolio  # noqa: E402
from ghost.models import Question, TranscriptTurn  # noqa: E402
from ghost.pipeline import run  # noqa: E402
from ghost.questions import generate_questions  # noqa: E402
from ghost.report import to_markdown  # noqa: E402

SAMPLES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "data", "samples")


def sample(name):
    with open(os.path.join(SAMPLES, name), "r", encoding="utf-8") as handle:
        return handle.read()


def turn(role, text, start, end, question_id=None):
    return TranscriptTurn(
        speaker="Interviewer" if role == "interviewer" else "Candidate",
        role=role, text=text, start_s=start, end_s=end, question_id=question_id,
    )


def conversational(count=6, start=0.0):
    """Ordinary, slightly disfluent answers - the false-positive baseline."""
    bodies = [
        "Yeah so, um, we ran it as a nightly job at first and it kept falling over "
        "on the big customers. I ended up splitting it per tenant, which was, uh, "
        "not elegant but it held.",
        "I think the main thing was, like, we didn't have replay. So when it broke "
        "you just lost the window. I put Kafka in front of it so we could re-read.",
        "Um, honestly the first version was too clever. I wrote a bloom filter and "
        "it missed duplicates that came in weeks apart, so we, you know, went simpler.",
        "So the trade-off was blast radius against duplication. We picked blast "
        "radius, and, uh, I'd do it again but generate the config instead.",
        "That one I owned end to end. I did the schema, the consumer, and most of "
        "the tests. One of the platform folks did the Terraform side of it.",
        "Right, so the dashboard was taking like eight seconds. I pre-aggregated "
        "the series and it went under a second, which people noticed straight away.",
    ]
    turns = []
    clock = start
    for index in range(count):
        turns.append(turn("interviewer", "Tell me about that piece of work?", clock, clock + 8))
        clock += 9.2
        turns.append(turn("candidate", bodies[index % len(bodies)], clock, clock + 40))
        clock += 42.0
    return transcript.compute_latency(turns)


class TestTranscript(unittest.TestCase):
    def test_vtt_parses_speakers_roles_and_latency(self):
        turns = transcript.from_vtt(sample("interview_priya_raman.vtt"))
        self.assertEqual(len(turns), 18)
        self.assertEqual(turns[0].role, "interviewer")
        self.assertEqual(turns[1].role, "candidate")
        self.assertEqual(turns[1].speaker, "Priya Raman")
        # The deliberate 10.6s pause before the Cosmos DB answer.
        pauses = [t.latency_s for t in turns if t.role == "candidate"]
        self.assertAlmostEqual(max(pauses), 10.6, places=1)

    def test_overlapping_speech_is_not_a_pause(self):
        turns = transcript.compute_latency([
            turn("interviewer", "So what happened?", 0.0, 10.0),
            turn("candidate", "Sorry, jumping in there", 8.0, 20.0),
        ])
        self.assertEqual(turns[1].latency_s, 0.0)

    def test_json_transcript_round_trip(self):
        turns = transcript.from_json({
            "interviewers": ["Marcus Webb"],
            "turns": [
                {"speaker": "Marcus Webb", "text": "Question?", "start_s": 0, "end_s": 5},
                {"speaker": "Ana Silva", "text": "Answer.", "start_s": 6.5, "end_s": 20},
            ],
        })
        self.assertEqual([t.role for t in turns], ["interviewer", "candidate"])
        self.assertAlmostEqual(turns[1].latency_s, 1.5, places=2)

    def test_closing_question_does_not_inherit_a_question_id(self):
        questions = [Question(id="q1", text="Tell me about the Kafka pipeline you built",
                              competency="system design", difficulty="core",
                              grounded_in="Built a Kafka pipeline")]
        turns = [
            turn("interviewer", "Tell me about the Kafka pipeline you built?", 0, 8),
            turn("candidate", "Sure, I built it over four months.", 9, 40),
            turn("interviewer", "Anything you want to ask me before we wrap?", 41, 45),
            turn("candidate", "What does on-call look like?", 46, 50),
        ]
        tagged = transcript.attach_questions(turns, questions)
        self.assertEqual(tagged[1].question_id, "q1")
        self.assertIsNone(tagged[3].question_id)

    def test_framing_without_a_question_mark_starts_nothing(self):
        questions = [Question(id="q1", text="What is the most recent thing you built with Prometheus?",
                              competency="reliability", difficulty="warmup", grounded_in="x")]
        turns = [
            turn("interviewer", "I'd like to spend most of the time on things you built, "
                                "from your portfolio, recent work with Prometheus.", 0, 10),
            turn("candidate", "Sounds good.", 11, 15),
        ]
        tagged = transcript.attach_questions(turns, questions)
        self.assertIsNone(tagged[1].question_id)


class TestIngest(unittest.TestCase):
    def setUp(self):
        self.profile = parse_portfolio(sample("portfolio_priya_raman.md"), use_llm=False)
        self.spec = parse_job_description(sample("job_description_senior_backend.md"),
                                          use_llm=False)

    def test_name_headline_and_skills(self):
        self.assertEqual(self.profile.name, "Priya Raman")
        self.assertIn("Senior backend engineer", self.profile.headline)
        for skill in ("python", "kafka", "cosmos db", "azure"):
            self.assertIn(skill, self.profile.skills)

    def test_skills_section_is_not_mined_for_claims(self):
        # "Python, Go, SQL" is inventory, not an achievement worth probing.
        sources = {claim.source for claim in self.profile.claims}
        self.assertNotIn("skills", sources)

    def test_quantified_claims_rank_above_vague_ones(self):
        top = self.profile.claims[0]
        self.assertGreater(top.specificity, 0.5)

    def test_role_competencies_are_derived(self):
        self.assertIn("system design", self.spec.competencies)
        self.assertIn("data engineering", self.spec.competencies)

    def test_markdown_emphasis_is_stripped_from_claims(self):
        for claim in self.profile.claims:
            self.assertNotIn("**", claim.text)


class TestQuestions(unittest.TestCase):
    def test_every_question_is_grounded_in_the_portfolio(self):
        profile = parse_portfolio(sample("portfolio_priya_raman.md"), use_llm=False)
        spec = parse_job_description(sample("job_description_senior_backend.md"), use_llm=False)
        questions = generate_questions(profile, spec, count=8, use_llm=False)
        self.assertEqual(len(questions), 8)
        for question in questions:
            self.assertTrue(question.grounded_in)
            self.assertTrue(question.text.endswith("?"))
            self.assertIn(question.difficulty, ("warmup", "core", "stretch"))

    def test_questions_cover_more_than_one_competency(self):
        profile = parse_portfolio(sample("portfolio_priya_raman.md"), use_llm=False)
        spec = parse_job_description(sample("job_description_senior_backend.md"), use_llm=False)
        questions = generate_questions(profile, spec, count=8, use_llm=False)
        self.assertGreater(len({q.competency for q in questions}), 1)

    def test_empty_portfolio_falls_back_to_the_job_description(self):
        profile = parse_portfolio("", use_llm=False)
        spec = parse_job_description(sample("job_description_senior_backend.md"), use_llm=False)
        questions = generate_questions(profile, spec, count=4, use_llm=False)
        self.assertEqual(len(questions), 4)
        for question in questions:
            self.assertTrue(question.text.strip())


class TestIntegrity(unittest.TestCase):
    def test_ordinary_conversation_is_not_flagged(self):
        signals = integrity.analyse(conversational(), use_llm=False)
        self.assertEqual(signals, [], "detectors fired on ordinary speech: {}".format(
            [s.kind for s in signals]))

    def test_short_interview_produces_no_statistical_signals(self):
        """Below the baseline threshold we must stay silent rather than guess."""
        turns = transcript.compute_latency([
            turn("interviewer", "Tell me about it?", 0, 5),
            turn("candidate", "Sure, um, I built the thing.", 6, 20),
            turn("interviewer", "And then?", 21, 25),
            turn("candidate", "Then we shipped it, yeah.", 55, 70),  # 30s pause
        ])
        signals = integrity.analyse(turns, use_llm=False)
        self.assertEqual([s for s in signals if s.kind == "response_latency"], [])

    def test_long_pause_is_flagged_relative_to_the_candidate(self):
        turns = conversational()
        turns.append(turn("interviewer", "One more question?", 600, 610))
        turns.append(turn("candidate",
                          "Um, so, the answer there is that we sharded it by tenant "
                          "and it worked out fine in the end I think.", 625, 660))
        turns = transcript.compute_latency(turns)
        signals = integrity.analyse(turns, use_llm=False)
        latency = [s for s in signals if s.kind == "response_latency"]
        self.assertEqual(len(latency), 1)
        self.assertEqual(latency[0].severity, "high")
        self.assertEqual(latency[0].turn_index, len(turns) - 1)

    def test_pause_must_be_long_in_absolute_terms(self):
        """A crisp speaker whose gaps are 0.2s must not be flagged for a 2s pause."""
        turns = []
        clock = 0.0
        for index in range(6):
            turns.append(turn("interviewer", "Next question?", clock, clock + 5))
            gap = 2.0 if index == 5 else 0.2
            clock += 5 + gap
            turns.append(turn("candidate", "Short answer number {}.".format(index),
                              clock, clock + 10))
            clock += 10
        turns = transcript.compute_latency(turns)
        signals = integrity.analyse(turns, use_llm=False)
        self.assertEqual([s for s in signals if s.kind == "response_latency"], [])

    def test_textbook_register_shift_is_flagged(self):
        turns = conversational()
        turns.append(turn("interviewer", "How would you approach partitioning?", 600, 610))
        turns.append(turn("candidate",
                          "There are several considerations when designing a partitioning "
                          "strategy. The primary objective is to select a partition key that "
                          "distributes both storage and request volume evenly across logical "
                          "partitions, thereby avoiding hot partitions. It is important to "
                          "consider the logical partition limit, as an unbounded key will "
                          "eventually result in write failures.", 612, 700))
        turns = transcript.compute_latency(turns)
        signals = integrity.analyse(turns, use_llm=False)
        shifts = [s for s in signals if s.kind == "register_shift"]
        self.assertEqual(len(shifts), 1)
        self.assertEqual(shifts[0].turn_index, len(turns) - 1)

    def test_filler_words_are_matched_on_word_boundaries(self):
        """'consumer' contains 'um'; substring counting made textbook prose look disfluent."""
        metrics = integrity.TurnMetrics(
            turn("candidate", "The consumer assumed the volume would resume.", 0, 10), 0)
        self.assertEqual(metrics.filler, 0.0)

    def test_first_person_is_matched_on_word_boundaries(self):
        metrics = integrity.TurnMetrics(
            turn("candidate", "Some volume time became unbounded.", 0, 10), 0)
        self.assertEqual(metrics.first_person, 0.0)

    def test_paraphrasing_a_claim_is_not_a_mismatch(self):
        """The candidate answers in their own words - that must not be flagged."""
        question = Question(
            id="q1",
            text="Tell me about the deduplication service?",
            competency="data engineering",
            difficulty="core",
            grounded_in="Wrote the deduplication service in Go that removed roughly 8% "
                        "duplicate records from the warehouse feed",
        )
        answer = turn("candidate",
                      "The dedup service, yeah. It removes duplicates from the warehouse "
                      "records before they land. The first version was a bloom filter, "
                      "which missed duplicates arriving weeks apart, so I moved it to a "
                      "keyed store with a ninety day window instead.", 0, 60, "q1")
        metrics = [integrity.TurnMetrics(answer, 0)]
        self.assertEqual(integrity.detect_portfolio_mismatch(metrics, [question]), [])

    def test_answer_that_avoids_the_claim_is_flagged(self):
        question = Question(
            id="q1",
            text="Tell me about the on-call runbook?",
            competency="reliability and operations",
            difficulty="core",
            grounded_in="Own the on-call runbook for the tracking platform; reduced page "
                        "volume by 60% by fixing the three alerts that produced most noise",
        )
        answer = turn("candidate",
                      "There are a few standard failure modes to think about at that kind "
                      "of scale. Typically the first thing to degrade is queue consumer lag, "
                      "because consumers scale more slowly than producers do. It is important "
                      "to ensure back-pressure is applied upstream rather than allowing "
                      "memory to grow without bound.", 0, 60, "q1")
        metrics = [integrity.TurnMetrics(answer, 0)]
        found = integrity.detect_portfolio_mismatch(metrics, [question])
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0].kind, "portfolio_mismatch")

    def test_ownership_flip_is_flagged(self):
        turns = conversational()
        turns.append(turn("interviewer", "Who built that?", 600, 605))
        turns.append(turn("candidate",
                          "I built the ingestion pipeline myself over about four months.",
                          606, 640))
        turns.append(turn("interviewer", "And the partitioning?", 641, 645))
        turns.append(turn("candidate",
                          "Honestly the team built the ingestion pipeline before I joined, "
                          "so I inherited most of it.", 646, 680))
        turns = transcript.compute_latency(turns)
        signals = integrity.analyse(turns, use_llm=False)
        flips = [s for s in signals if s.kind == "ownership_inconsistency"]
        self.assertEqual(len(flips), 1)

    def test_no_signal_ever_claims_cheating(self):
        session = run(sample("portfolio_priya_raman.md"),
                      sample("job_description_senior_backend.md"),
                      transcript_text=sample("interview_priya_raman.vtt"),
                      use_llm=False)
        banned = ("cheat", "cheating", "dishonest", "guilty", "fraud", "lying", "liar")
        for signal in session.report.signals:
            blob = " ".join([signal.summary, signal.rationale, signal.suggested_follow_up]).lower()
            for word in banned:
                self.assertNotIn(word, blob,
                                 "signal {} used the word '{}'".format(signal.kind, word))

    def test_baseline_reports_its_own_reliability(self):
        short = integrity.baseline_summary(conversational(count=2))
        self.assertFalse(short["baseline_reliable"])
        long = integrity.baseline_summary(conversational(count=6))
        self.assertTrue(long["baseline_reliable"])


class TestReport(unittest.TestCase):
    def setUp(self):
        self.session = run(sample("portfolio_priya_raman.md"),
                           sample("job_description_senior_backend.md"),
                           transcript_text=sample("interview_priya_raman.vtt"),
                           question_count=8,
                           use_llm=False,
                           interview_date="2026-07-29")

    def test_every_question_gets_a_packet(self):
        self.assertEqual(len(self.session.report.packets), len(self.session.questions))

    def test_answered_packets_carry_a_quote_and_timestamp(self):
        answered = [p for p in self.session.report.packets if p.candidate_answer]
        self.assertGreater(len(answered), 0)
        for packet in answered:
            self.assertTrue(packet.transcript_quote)
            self.assertRegex(packet.timestamp, r"^\d{2}:\d{2}$")

    def test_unasked_questions_are_recorded_as_not_asked(self):
        unasked = [p for p in self.session.report.packets if not p.candidate_answer]
        for packet in unasked:
            self.assertEqual(packet.interviewer_disposition, "not asked")

    def test_ghost_never_fills_in_a_disposition(self):
        for packet in self.session.report.packets:
            self.assertIn(packet.interviewer_disposition, ("", "not asked"))

    def test_known_signals_land_on_the_expected_moments(self):
        found = {(s.timestamp, s.kind) for s in self.session.report.signals}
        self.assertIn(("05:28", "response_latency"), found)
        self.assertIn(("05:28", "register_shift"), found)
        self.assertIn(("07:13", "ownership_inconsistency"), found)

    def test_coverage_names_every_role_competency(self):
        for competency in self.session.spec.competencies:
            self.assertIn(competency, self.session.report.coverage)

    def test_markdown_export_contains_the_disclaimer_and_evidence(self):
        markdown = to_markdown(self.session.report, self.session.transcript)
        self.assertIn("does not determine whether", markdown)
        self.assertIn("## Evidence packets", markdown)
        self.assertIn("Priya Raman", markdown)

    def test_prepare_only_run_produces_no_report(self):
        session = run(sample("portfolio_priya_raman.md"),
                      sample("job_description_senior_backend.md"),
                      use_llm=False)
        self.assertIsNone(session.report)
        self.assertTrue(session.questions)


if __name__ == "__main__":
    unittest.main()
