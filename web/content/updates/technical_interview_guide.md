# TECHNICAL INTERVIEW COMPANION — Full-Stack Developer (React + AI/LLM)

Keep this open during the interview. Read, don't recite.

---

## 1. CONTEXT SNAPSHOT

- You passed the HR screening with Ana Luisa (PiplNow LLC, staffing agency). Next step: technical interview, almost certainly with a developer from the end client.
- Role: **Full-Stack Developer, React + TypeScript + Python, AI/LLM focus** (OpenAI, LangChain, agent frameworks). Contractor, full time, $18–20/h (you anchored $20, pending).
- "Developer" title = they want **execution**: build features, integrate APIs, ship. Show delivery, not architecture diagrams.
- Interview will be in English. Short answers (30–60s), think out loud, ask clarifying questions.

**Ask early:** "Is this role more about feature delivery or architecture ownership?" — then calibrate.

---

## 2. YOUR TECHNICAL PITCH (60 seconds)

> "I'm a full-stack developer with 6 years of experience. My core stack is TypeScript end to end: React on the front, Node and NestJS on the back, PostgreSQL and MongoDB for data, deployed on AWS with Docker and CI/CD. I spent the last years in fintech and digital banking, so I'm used to production systems where mistakes cost money. On the AI side, I founded TicoAI, an AI assistant that runs in production: it sees the user's screen, takes voice questions, and answers out loud pointing at UI elements. I built the whole thing, including the LLM integrations and the agent logic. So the React plus AI combination in this role is literally what I do every day."

---

## 3. LIKELY QUESTIONS + ANSWERS

### React

**"What's the difference between state and props?"**
> "Props flow down from the parent and are read-only. State is owned by the component and triggers re-renders when it changes. Rule of thumb: lift state up only when siblings need it, keep it local otherwise."

**"When does a React component re-render, and how do you avoid unnecessary re-renders?"**
> "When its state changes, when its parent re-renders, or when context it consumes changes. To avoid waste: memoize components with React.memo, stabilize callbacks with useCallback, derive expensive values with useMemo, and keep state as close as possible to where it's used. But I profile first — premature memoization adds noise."

**"Common useEffect mistakes?"**
> "Missing or wrong dependencies, doing data fetching without cancellation so you get race conditions, and using effects for things that should be event handlers or derived state. I keep effects small and I clean up subscriptions in the return function."

**"How do you handle data fetching in React?"**
> "For real projects I prefer a query library like React Query: it gives caching, retries, loading and error states out of the box. Manually, it's fetch in an effect with an abort controller, plus explicit loading and error state. Never leave a request without error handling."

**"How do you manage global state?"**
> "I start with lifting state and context for small things. When it grows, Redux Toolkit or Zustand. In my fintech work I used Redux for shared financial data and NgRx on the Angular side. The principle is the same: single source of truth, predictable updates."

### TypeScript

**"Why TypeScript over JavaScript?"**
> "It catches whole categories of bugs at compile time, makes refactoring safe, and turns the type system into living documentation. On teams it's a communication tool as much as a safety tool."

**"interface vs type?"**
> "Mostly interchangeable. Interfaces can be extended and merged, types handle unions and intersections better. I use interfaces for object shapes and types for unions and utilities. Consistency matters more than the choice."

**"What are generics? Give a real use."**
> "Type parameters that keep type safety across reusable code. A real one: a typed API client, like `apiGet<User>('/users/1')`, so the response is typed without casting everywhere."

### Backend / REST / Node

**"How do you design a REST API?"**
> "Resources as nouns, verbs from HTTP: GET, POST, PUT, DELETE. Correct status codes, consistent error shape, pagination on lists, versioning when contracts change, and auth via JWT or sessions depending on the client. I document with OpenAPI so front and back agree on the contract."

**"How does Node handle concurrency?"**
> "Single-threaded event loop with non-blocking I/O. Great for I/O-heavy APIs. CPU-heavy work goes to worker threads or a separate service, otherwise you block the loop and everything stalls."

**"How do you handle errors in an API?"**
> "Centralized error middleware, typed error classes, consistent JSON error shape, correct status codes, and logs with enough context to debug. Never leak internals to the client."

**"SQL vs NoSQL — how do you choose?"**
> "Relational data with transactions: PostgreSQL. Flexible documents or fast iteration on schema: MongoDB. I've run both in production. The honest answer is the data model and query patterns decide, not fashion."

### AI / LLM (your strongest card — expand here)

**"Tell me about your experience with LLMs."**
> "Production experience through TicoAI. I handle the full cycle: prompt design, context window management, streaming responses, function calling for agent actions, fallbacks when the model fails, and cost and latency control. I also use AI-assisted coding daily, like Claude Code, so I'm on both sides: building AI products and building with AI."

**"How do you design a good prompt?"**
> "Clear role and task, the context the model actually needs and nothing more, explicit output format, and examples when the format matters. Then I iterate against real failure cases. I treat prompts like code: versioned and tested."

**"What is RAG?"**
> "Retrieval-Augmented Generation: instead of relying on the model's memory, you embed your documents, store vectors, retrieve the most relevant chunks for a query, and inject them into the prompt. It grounds answers in your data and cuts hallucination."

**"What are agents / function calling?"**
> "You give the model tools with defined schemas. It decides which tool to call and with what arguments, your code executes it, and the result goes back to the model until the task is done. TicoAI works this way: the model can point at screen elements and trigger UI actions as tools."

**"How do you control hallucinations?"**
> "Ground with RAG or tool results, constrain the output format, lower temperature for factual tasks, validate outputs in code before acting on them, and design the UX so the model can say 'I don't know'."

### Python (the declared gap — honest script)

**"How's your Python?"**
> "It's my secondary language, I'm upfront about that. I read it fine and I've used it for scripts and small services. My production muscle memory is TypeScript. The AI concepts transfer directly, and picking up FastAPI patterns is a matter of days, not months. Happy to prove it in the technical challenge."

**Quick Python review before the interview (2 hours max):**
- Syntax: list comprehensions, dicts, `def`, classes, `async def` / `await`
- FastAPI hello world: route, path params, Pydantic model for request/response
- How `pip install fastapi uvicorn` and `uvicorn main:app --reload` work

### Behavioral-technical

**"Tell me about a hard bug you fixed."**
> "In a fintech microservices setup, we had intermittent payment failures. Logs showed nothing obvious. I traced it to a race condition between a queue consumer and a database update: the consumer read stale state. Fixed with an idempotency key and ordering guarantees. Lesson: distributed bugs need tracing across services, not just one log file."

**"How do you handle code review feedback?"**
> "I treat it as free senior advice. I ask why when I disagree, and I've changed my mind plenty. Reviews are where teams converge on standards."

**"How do you work without a PM babysitting you?"**
> "I run my own product, so self-direction is my default. I break work into small deliverables, communicate status early, flag blockers immediately, and I'd rather ship something reviewable today than something perfect next week."

---

## 4. IF THERE'S LIVE CODING

- **Think out loud.** Silence reads as being lost. Narrate: "First I'll fetch the data, then handle the loading state..."
- **Clarify before coding:** "Can I use React Query or do you want plain fetch?" / "Do you care about edge cases like empty lists?"
- Classic tasks at this level: fetch and render a list with filter/search, debounce an input, build a small form with validation, fix a broken useEffect, FizzBuzz-tier logic in JS.
- If stuck: "Let me write the naive version first, then improve it." That sentence saves interviews.
- Test your own code at the end without being asked. Interviewers notice.

**Warm up before the call (30 min):** two easy JS exercises timed, one small React component from scratch, speaking English out loud while doing it.

---

## 5. TICOAI DEEP-DIVE (they WILL ask — own this)

Be ready to explain, in order:
1. **What it does:** on-screen AI assistant, follows the cursor, voice input, sees the screen, answers out loud pointing at elements, multi-language.
2. **Stack:** front-end overlay (React/TS), Node back end, LLM APIs, voice in/out, deployed and maintained by you.
3. **Hardest problem:** (pick your real one — latency of voice→LLM→voice loop, screen context extraction, or agent reliability) and how you solved it.
4. **Production lessons:** cost control, prompt versioning, failure fallbacks, real users complaining about real things.

One-liner: "TicoAI is my proof that I don't just integrate an API, I ship an AI product end to end."

---

## 6. YOUR QUESTIONS (pick 2–3)

1. "What does the product do, and what would my first deliverable be?"
2. "How is the AI side built today: which models, any RAG or agents in production already?"
3. "What does the team look like, and how do you review and ship code?"
4. "What's the timeline: how many steps left, and when do you want someone starting?"

---

## 7. EMERGENCY ENGLISH

- Didn't catch it: "Sorry, could you repeat that?" / "Could you rephrase it?"
- Buy time: "Good question, give me a second to think."
- Unknown tech: "I haven't used that specifically. The closest thing I've worked with is..., and here's how I'd approach it."
- Connection issue: "I think the audio dropped, could you say that again?"

## 8. PRE-CALL CHECKLIST

- [ ] Join 5 min early, camera on, quiet room, test mic
- [ ] VS Code open with a blank React + TS sandbox (in case of live coding)
- [ ] trotta.dev and TicoAI open in tabs, ready to demo if asked
- [ ] This file open on the side
- [ ] Water, notepad, phone on silent
- [ ] After the call: thank-you message to Ana the same day
