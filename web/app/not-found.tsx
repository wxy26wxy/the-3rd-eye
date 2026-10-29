import { m } from "@/components/messages";
import { Tag } from "@/components/Tag";
import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Container, Section, Stack } from "@/components/ui/Layout";
import { Lead } from "@/components/ui/Text";

export default function NotFound() {
  return (
    <main id="main">
      <Container width="narrow">
        <Section>
          <Stack gap="xxl">
            <Tag pose="waving" decorative />
            <Display as="h1" size="xl">{m.notFound.title}</Display>
            <Lead>{m.notFound.copy}</Lead>
            <div><Button href="/">{m.notFound.home}</Button></div>
          </Stack>
        </Section>
      </Container>
    </main>
  );
}
