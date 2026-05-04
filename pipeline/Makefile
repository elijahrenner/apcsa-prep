.PHONY: install seed audit clean publish stage1 stage2 stage3 stage4 stage5 stage6 stage7 stage8 quick-validate

PYTHON ?= python3
VENV   ?= .venv
ACT    := . $(VENV)/bin/activate

install:
	$(PYTHON) -m venv $(VENV)
	$(ACT) && pip install -r requirements.txt

stage1:
	$(ACT) && $(PYTHON) -m pipeline.stage1_parse_princeton

stage2:
	$(ACT) && $(PYTHON) -m pipeline.stage2_format_spec

stage3:
	$(ACT) && $(PYTHON) -m pipeline.stage3_mcq_generate

stage4:
	$(ACT) && $(PYTHON) -m pipeline.stage4_validate

stage5:
	$(ACT) && $(PYTHON) -m pipeline.stage5_critic

stage6:
	$(ACT) && $(PYTHON) -m pipeline.stage6_frq_generate

stage7:
	$(ACT) && $(PYTHON) -m pipeline.stage7_frq_self_test

stage8:
	$(ACT) && $(PYTHON) -m pipeline.stage8_load

# Publish raw_* + validated_* into the clean canonical layout (data/{mcqs,frqs,practice_tests}/).
# Also assembles 3 synthetic practice tests modeled on the PR exam structure.
publish:
	$(ACT) && $(PYTHON) -m pipeline.publish

# Single-topic Stage 4 for fast iteration: `make quick-validate TOPIC=u1_s1_15`
quick-validate:
	@if [ -z "$(TOPIC)" ]; then echo "usage: make quick-validate TOPIC=u1_s1_15"; exit 1; fi
	$(ACT) && $(PYTHON) -m pipeline.stage4_validate $(TOPIC)

seed: stage1 stage2 stage3 stage4 stage5 stage6 stage7 stage8 publish

audit:
	$(ACT) && $(PYTHON) -m pipeline.audit

clean:
	rm -rf data/raw_mcqs data/validated_mcqs data/raw_frqs data/apcsa.db
