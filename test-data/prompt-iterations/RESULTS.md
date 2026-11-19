# Prompt iteration results

Run on 2026-11-19 12:33 UTC · model `openai/gpt-oss-120b` via Groq · notes: `test-data/sample-notes.txt` · 5 MCQs requested per run · 5 runs per version.
Prompt texts: `prompts/v1/generate.txt`, `prompts/v2/generate.txt`, `prompts/v3/generate.txt`.

| Version | Output usable by the app (no cleanup) | Exactly 5 well-formed MCQs | "All/none of the above" options | Source quotes word-for-word from notes | Questions passing the verifier | Failed runs | Avg time (s) |
|---|---|---|---|---|---|---|---|
| v1 | 0/5 | n/a | 0 | n/a | n/a | 0 | 1.6 |
| v2 | 5/5 | 5/5 | 0 | n/a | 25/25 (100%) | 0 | 14.5 |
| v3 | 5/5 | 5/5 | 0 | 25/25 | 25/25 (100%) | 0 | 50.3 |

How each column is measured:
- **Usable by the app**: v1/v2 = the reply is valid JSON as-is; v3 = the forced tool call passed the zod check on the first attempt.
- **Questions passing the verifier**: each question is re-answered by the app's own verifier prompt (P3) without the answer key; it passes only if the verifier finds it answerable from the notes and picks the same answer.
- v1 is free text, so it can't be checked automatically. Read the sample below for what it looks like.

## Sample output — v1
```
**Quiz – Transport‑Layer Basics (TCP vs. UDP)**  

*Read each question carefully and choose the best answer (a‑d). The correct answer is highlighted in **bold** at the end of the quiz.*

---

### 1. Which of the following describes the purpose of the transport layer?  
a. Routing packets between different networks.  
b. Providing end‑to‑end communication between processes on separate hosts.  
c. Converting domain names to IP addresses.  
d. Encrypting data before it leaves the sender’s computer.  

**Answer:** **b**

---

### 2. The three‑way handshake that establishes a TCP connection occurs in which order?  
a. SYN → ACK → FIN  
b. SYN → SYN‑ACK → ACK  
c. SYN‑ACK → SYN → ACK  
d. ACK → SYN → SYN‑ACK  

**Answer:** **b**

---

### 3. Which statement is **FALSE** about UDP?  
a. It is connectionless and does not perform a handshake.  
b. It guarantees in‑order delivery of all datagrams.  
c. Its header is only 8 bytes long.  
d. It is often used for real‑time applications like video streaming.  

**Answer:** **b**

---

### 4. What mechanism does TCP use to prevent a fast sender from overwhelming a slow receiver?  
a. Congestion avoidance  
b. Sliding‑window flow control  
c. Datagram fragmentation  
d. Packet tagging  

**Answer:** **b**

---

### 5. Which pair correctly matches an application type with the protocol it typically uses?  

a. File transfer – UDP  
b. Live gaming – TCP  
c. DNS lookup – UDP  
d. Email – UDP  

**Answer:** **c**

---

#### Scoring (optional)  
- 5 correct: Excellent – you’ve mastered the fundamentals!  
- 3‑4 correct: Good – a little review and you’ll be solid.  
- 0‑2 correct: Review the notes and try again.  

---  

*Feel free to shuffle the questions or change the answer order when you reuse the quiz.*
```

## Sample output — v2
```
{
  "mcqs": [
    {
      "question": "What is the three-way handshake sequence for establishing a TCP connection?",
      "options": [
        "SYN, SYN-ACK, ACK",
        "ACK, SYN, FIN",
        "SYN, ACK, FIN",
        "FIN, SYN, ACK"
      ],
      "answer": "SYN, SYN-ACK, ACK"
    },
    {
      "question": "Which protocol uses a smaller header size?",
      "options": [
        "TCP (20 bytes)",
        "UDP (8 bytes)",
        "Both have the same size",
        "TCP (8 bytes)"
      ],
      "answer": "UDP (8 bytes)"
    },
    {
      "question": "Which of the following is NOT a characteristic of UDP?",
      "options": [
        "Connectionless",
        "Guarantees reliable delivery",
        "No handshake before sending data",
        "Does not retransmit lost datagrams"
      ],
      "answer": "Guarantees reliable delivery"
    },
    {
      "question": "Which transport‑layer protocol provides flow control using a sliding window?",
      "options": [
        "TCP",
        "UDP",
        "IP",
        "ICMP"
      ],
      "answer": "TCP"
    },
    {
      "question": "Which type of application typically uses UDP?",
      "options": [
        "Web browsing",
        "Email",
        "File transfer",
        "Live video streaming"
      ],
      "answer": "Live video streaming"
    }
  ]
}
```

## Sample output — v3
```json
{
  "title": "TCP vs UDP Transport Layer",
  "mcqs": [
    {
      "source_quote": "A connection is set up with a three-way handshake: SYN, SYN-ACK, ACK.",
      "concept": "Three-way handshake",
      "difficulty": "medium",
      "bloom": "apply",
      "question": "Which transport protocol establishes a connection using a three-way handshake (SYN, SYN-ACK, ACK)?",
      "correct_answer": "TCP",
      "distractors": [
        "UDP",
        "IP",
        "ICMP"
      ],
      "explanation": "The notes state that a connection is set up with a three-way handshake, which is described for TCP."
    },
    {
      "source_quote": "Applications that need every byte delivered correctly, such as web browsing, email and file transfer, use TCP.",
      "concept": "Reliability requirement",
      "difficulty": "medium",
      "bloom": "apply",
      "question": "An application that must ensure every byte arrives correctly (e.g., web browsing) should use which transport protocol?",
      "correct_answer": "TCP",
      "distractors": [
        "UDP",
        "IP",
        "HTTP"
      ],
      "explanation": "The notes say applications needing every byte delivered correctly use TCP."
    },
    {
      "source_quote": "UDP has a smaller header (8 bytes) than TCP (20 bytes minimum), so it has lower overhead.",
      "concept": "Header size",
      "difficulty": "medium",
      "bloom": "apply",
      "question": "Which protocol has the smaller header size, resulting in lower overhead?",
      "correct_answer": "UDP",
      "distractors": [
        "TCP",
        "IP",
        "ICMP"
      ],
      "explanation": "The notes compare header sizes, stating UDP’s header is 8 bytes versus TCP’s minimum 20 bytes."
    },
    {
      "source_quote": "TCP uses flow control (a sliding window) so a fast sender does not overwhelm a slow receiver.",
      "concept": "Flow control mechanism",
      "difficulty": "medium",
      "bloom": "analyze",
      "question": "How does TCP prevent a fast sender from overwhelming a slow receiver?",
      "correct_answer": "It uses flow control with a sliding window.",
      "distractors": [
        "It uses congestion control to reduce sending rate.",
        "It retransmits lost segments using acknowledgements.",
        "It establishes a three‑way handshake before sending data."
      ],
      "explanation": "The notes explain that TCP uses flow control (a sliding window) so a fast sender does not overwhelm a slow receiver."
    },
    {
      "source_quote": "Applications that need speed more than reliability, such as live video streaming, online gaming and DNS lookups, commonly use UDP.",
      "concept": "Application suitability",
      "difficulty": "medium",
      "bloom": "apply",
      "question": "A live video streaming service prioritizes speed over reliability. Which transport protocol is most appropriate for this application?",
      "correct_answer": "UDP",
      "distractors": [
        "TCP",
        "IP",
        "HTTP"
      ],
      "explanation": "The notes list live video streaming among applications that need speed more than reliability and commonly use UDP."
    }
  ],
  "short_answers": [],
  "flashcards": []
}
```
