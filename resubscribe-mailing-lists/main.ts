/**
 * We have some special subscribers in our listmonks, e.g. our students mailing list.
 * If one of the subscribers of the students mailing list unsubscribes, the whole list will be unsubscribed. That's why
 * this script checks if any of the special subscribers are unsubscribed and resubscribes them.
 */
const endpoint = "https://news.kinoimblauensalon.de/api";
const token = Deno.env.get("LISTMONK_TOKEN");

const mailingLists = ["studierende@hfg-karlsruhe.de"];

export async function run(): Promise<void> {
  for await (const email of mailingLists) {
    console.info(`Resubscribing ${email} to their lists...`);
    const subscriber = await fetchSubscriber(email);

    if (!subscriber) {
      continue;
    }

    const unsubscribedLists = subscriber.lists.filter(
      (list) => list.subscription_status === "unsubscribed"
    );

    console.info(
      `${email} is subscribed to ${
        subscriber.lists.length - unsubscribedLists.length
      }/${subscriber.lists.length} lists.`
    );

    if (unsubscribedLists.length === 0) {
      console.info("No lists to resubscribe to.\n");
      continue;
    }

    console.info(
      `resubscribing ${email} (id: ${
        subscriber.id
      }) to list(s) ${unsubscribedLists.map((list) => list.id).join(", ")} ...`
    );

    const res = await fetch(`${endpoint}/subscribers/lists`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids: [subscriber.id],
        target_list_ids: unsubscribedLists.map((list) => list.id),
        action: "add",
        status: "unconfirmed",
      }),
    });
    if (!res.ok) {
      console.error("re-subscribing failed:");
      console.error(await res.text());
      continue;
    }

    console.info(
      `Successfully resubscribed ${email} to ${unsubscribedLists.length} lists.\n`
    );
  }
}

const fetchSubscriber = async (
  email: string
): Promise<{
  id: number;
  email: string;
  lists: {
    // "unconfirmed" means subscribed for lists without double opt-in
    // "confirmed" means subscribed for lists with double opt-in
    // "unsubscribed" means unsubscribed
    subscription_status: "unconfirmed" | "confirmed" | "unsubscribed";
    id: number;
  }[];
} | null> => {
  const res = await fetch(
    `${endpoint}/subscribers?subscribers.email='${email}'`,
    {
      headers: {
        Authorization: `token ${token}`,
      },
    }
  );
  if (!res.ok) {
    console.error(`failed to fetch subscriber ${email}`);
    console.error(res.statusText);
    return null;
  }

  const data = await res.json();
  if (data.data.results.length === 0) {
    console.log(`subscriber not found ${email}`);
    return null;
  }

  return data.data.results[0];
};

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  run().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
