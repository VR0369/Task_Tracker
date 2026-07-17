"""Motivational quotes — a curated built-in set, random per call."""

import random
from typing import Dict

QUOTES = [
    ("Time is the one thing you can never earn back. Spend it wisely.", "Unknown", "time"),
    ("The way to get started is to quit talking and begin doing.", "Walt Disney", "productivity"),
    ("Success is the sum of small efforts repeated day in and day out.", "Robert Collier", "success"),
    ("Discipline is the bridge between goals and accomplishment.", "Jim Rohn", "discipline"),
    ("You don't have to be great to start, but you have to start to be great.", "Zig Ziglar", "procrastination"),
    ("Focus on being productive instead of busy.", "Tim Ferriss", "focus"),
    ("Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", "Stephen King", "discipline"),
    ("It always seems impossible until it's done.", "Nelson Mandela", "success"),
    ("Lost time is never found again.", "Benjamin Franklin", "time"),
    ("The secret of getting ahead is getting started.", "Mark Twain", "procrastination"),
    ("Concentrate all your thoughts upon the work at hand.", "Alexander Graham Bell", "focus"),
    ("Well done is better than well said.", "Benjamin Franklin", "productivity"),
    ("Either you run the day or the day runs you.", "Jim Rohn", "time"),
    ("Do the hard jobs first. The easy jobs will take care of themselves.", "Dale Carnegie", "discipline"),
    ("Your future is created by what you do today, not tomorrow.", "Robert Kiyosaki", "procrastination"),
    ("Motivation gets you going, but discipline keeps you growing.", "John C. Maxwell", "discipline"),
    ("Action is the foundational key to all success.", "Pablo Picasso", "success"),
    ("Starve your distractions, feed your focus.", "Unknown", "focus"),
    ("A year from now you may wish you had started today.", "Karen Lamb", "procrastination"),
    ("Productivity is never an accident. It is always the result of commitment.", "Paul J. Meyer", "productivity"),
]


def random_quote(exclude: str | None = None) -> Dict[str, str]:
    pool = [q for q in QUOTES if q[0] != exclude] or QUOTES
    text, author, category = random.choice(pool)
    return {"text": text, "author": author, "category": category}
