import type { TagMessage } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import styles from "./StoryTag.module.css";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Notes between the buyer and the creator on this order, oldest first: sender line above each bubble (Message bubble 2009:422). */
export function Thread({ messages, name }: { messages: TagMessage[]; name: string }) {
  return (
    <section aria-labelledby="thread-title" className={styles.block}>
      <h2 id="thread-title" className={styles.h2}>{m.tag.threadTitle}</h2>
      {messages.length === 0 ? <p className={styles.muted}>{m.tag.threadEmpty}</p> : (
        <ol role="list" className={styles.thread}>
          {messages.map((msg) => {
            const mine = msg.direction === "buyer_to_creator";
            return (
              <li key={msg.id} className={mine ? styles.mine : styles.theirs}>
                <p className={styles.from}>
                  {mine ? m.tag.fromYou : fmt(m.tag.fromCreator, { name })}
                  {" · "}
                  <time dateTime={new Date(msg.createdAt).toISOString()}>{when.format(new Date(msg.createdAt))}</time>
                </p>
                <p className={styles.bubble}>{msg.body}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
