"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ng/input";
import { Button } from "@/components/ng/button";

const SUBJECTS = ["Order or delivery", "Returns & quality", "Wholesale & corporate", "Press & media", "Something else"] as const;

/**
 * Front-end-only contact form. Validates locally and fires a sonner toast on
 * submit — there is no backend yet, so nothing is persisted or sent.
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please tell us your name");
      return;
    }
    if (!emailValid) {
      toast.error("Enter a valid email address");
      return;
    }
    if (message.trim().length < 10) {
      toast.error("Please add a little more detail to your message");
      return;
    }
    setSubmitting(true);
    // No backend: simulate a send, then confirm with a toast.
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Thanks. We've got your message. We'll reply within one business day.");
      setName("");
      setEmail("");
      setSubject(SUBJECTS[0]);
      setMessage("");
    }, 600);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid sm:grid-cols-2 gap-5">
        <Input
          label="Your name"
          placeholder="Priya Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-subject" className="text-[13px] font-medium text-ng-ink-muted">
          What&rsquo;s it about?
        </label>
        <select
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-12 px-4 rounded-xl bg-ng-paper border border-ng-line text-[15px] text-ng-ink outline-none focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-[13px] font-medium text-ng-ink-muted">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={5}
          placeholder="Tell us how we can help…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="px-4 py-3 rounded-xl bg-ng-paper border border-ng-line text-[15px] text-ng-ink placeholder:text-ng-ink-soft outline-none focus:border-ng-forest focus:shadow-[0_0_0_3px_rgba(184,212,154,0.30)] transition-all duration-200 resize-y"
        />
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={submitting} className="self-start">
        {submitting ? "Sending…" : "Send message"}
      </Button>

      <p className="text-[12.5px] text-ng-ink-soft">
        We&rsquo;ll only use your details to reply to this enquiry. See our{" "}
        <a href="/policies/privacy" className="text-ng-forest underline underline-offset-2 hover:text-ng-forest-deep">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
