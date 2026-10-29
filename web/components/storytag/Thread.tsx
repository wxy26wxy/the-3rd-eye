import type { TagMessage } from "@/lib/db/queries.contract";
import { fmt, m } from "@/components/messages";
import { Stack } from "@/components/ui/Layout";
import { Muted, Title } from "@/components/ui/Text";
import styles from "./StoryTag.module.css";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Notes between the buyer and the creator on this order, oldest first. */
export function Thread({ messages, name }: { messages: TagMessage[]; name: string }) {
  return (
    <section aria-labelledby="thread-title">
      <Stack gap="m">
        <Title id="thread-title">{m.tag.threadTitle}</Title>
        {messages.length === 0 ? <Muted>{m.tag.threadEmpty}</Muted> : (
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
                  <p>{msg.body}</p>
                </li>
              );
            })}
          </ol>
        )}
      </Stack>
    </section>
  );
}
