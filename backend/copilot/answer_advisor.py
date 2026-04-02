"""Answer Advisor — 结合策略树预计算 + LLM 流式生成回答建议。"""
import logging
import time
from collections.abc import AsyncIterator

from langchain_core.messages import SystemMessage, HumanMessage

from backend.llm_provider import get_copilot_llm
from backend.copilot.strategy_tree import StrategyTreeNavigator

logger = logging.getLogger("uvicorn")

_ADVISE_PROMPT = """你是一个面试教练。HR 刚问了候选人一个问题，请给出完整示例答案。

HR 的问题: {utterance}
候选人背景亮点: {highlights}
候选人弱点提醒: {weak_points}
已知回答要点参考: {key_points}

要求：
- 结合候选人背景和上述要点，写一段完整的示例答案，200字以内，自然口语化，像候选人在面试中真实说的话
- 如涉及弱点领域，答案中要有合理引导和转移
- 不要重复罗列要点，直接输出一段完整的回答
直接输出答案文本，不要任何前缀、标记或 JSON 格式。"""


def prepare_advice_context(
    utterance: str,
    node_id: str | None,
    navigator: StrategyTreeNavigator,
    prep_state: dict,
) -> dict:
    """预处理策略树上下文，返回 risk_alert 和构建好的 prompt。"""
    risk_alert = None
    key_points: list[str] = []

    if node_id:
        node = navigator.get_node(node_id)
        if node:
            key_points = list(node.get("recommended_points", []))
            risk_level = node.get("risk_level", "safe")
            if risk_level == "danger":
                risk_hint = _find_risk_hint(node_id, prep_state.get("prep_hints", []))
                if risk_hint:
                    key_points.extend(risk_hint.get("safe_talking_points", []))
                    risk_alert = risk_hint.get("redirect_suggestion", "")
                else:
                    risk_alert = f"注意：'{node.get('topic', '')}' 是你的薄弱领域，建议简述核心概念后引导到实际项目经验"
            elif risk_level == "caution":
                risk_alert = f"提示：'{node.get('topic', '')}' 需要注意，确保回答有条理"

    fit_report = prep_state.get("fit_report", {})
    highlights = fit_report.get("highlights", []) if isinstance(fit_report, dict) else []
    highlight_text = "; ".join(
        h.get("point", str(h)) if isinstance(h, dict) else str(h)
        for h in highlights[:3]
    ) or "无"

    profile = prep_state.get("profile", {})
    weak_points = profile.get("weak_points", [])
    weak_text = "; ".join(
        wp.get("point", str(wp)) if isinstance(wp, dict) else str(wp)
        for wp in weak_points[:5]
    ) or "无"

    prompt = _ADVISE_PROMPT.format(
        utterance=utterance,
        highlights=highlight_text,
        weak_points=weak_text,
        key_points="; ".join(key_points[:5]) or "无",
    )
    return {"prompt": prompt, "risk_alert": risk_alert}


async def stream_advice(prompt: str) -> AsyncIterator[str]:
    """流式调用 LLM，逐 chunk yield 文本。"""
    llm = get_copilot_llm(streaming=True)
    logger.info(f"Answer advisor streaming LLM: model={llm.model_name}, base_url={llm.openai_api_base}")
    t0 = time.monotonic()
    chunk_count = 0
    try:
        async for chunk in llm.astream([
            SystemMessage(content="直接输出答案，不要 JSON 格式"),
            HumanMessage(content=prompt),
        ]):
            if chunk.content:
                chunk_count += 1
                if chunk_count <= 3:
                    logger.info(f"Answer advisor chunk #{chunk_count} at {time.monotonic() - t0:.1f}s: {chunk.content[:30]!r}")
                yield chunk.content
        logger.info(f"Answer advisor stream completed in {time.monotonic() - t0:.1f}s, {chunk_count} chunks")
    except Exception as e:
        logger.error(f"Answer advisor stream failed after {time.monotonic() - t0:.1f}s: {type(e).__name__}: {e}")


def _find_risk_hint(node_id: str, prep_hints: list[dict]) -> dict | None:
    for hint in prep_hints:
        if hint.get("node_id") == node_id:
            return hint
    return None
