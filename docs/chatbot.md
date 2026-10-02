# Property assistant chatbot (Milestone 4)

A chat widget on the public pages (`/`, `/properties`, `/properties/:slug`). It
is not shown on the CRM, login or signup pages.

It is **rule-based**: there is no external AI service, API key or per-message
cost. Messages are understood by pattern rules in the browser, and every answer
about properties comes from the existing public Supabase queries.

## How it works

```
Visitor message
  → src/lib/chatParser.ts        extracts filters + intent (no network)
  → src/services/chatAssistant.ts decides what to do and queries Supabase:
       searchPublicProperties   (rpc search_properties, published only, 6 rows)
       getPublicPropertyBySlug  (published property details)
       listPublicLocations      (published cities / states)
  → reply text + property cards + suggestions (+ enquiry form)
```

**Understood requests (English and simple Hinglish)**

| Visitor says                                | Becomes                               |
| ------------------------------------------- | ------------------------------------- |
| "2 BHK in Jaipur under 40 lakh"             | bedrooms = 2, city, max price 4000000 |
| "between 30 and 60 lakh", "above 1.5 crore" | min / max price                       |
| "flats / villas / plots / offices"          | apartment / house / land / commercial |
| "for rent", "kiraye pe", "buy", "for sale"  | listing type                          |
| "jaipur me 2bhk 50 lakh tak"                | city, bedrooms, max price             |
| "at least 1200 sq ft", "2 bathrooms"        | area / bathrooms                      |
| "only rentals", "any location", "cheaper"   | refines the previous search           |
| "what is the price?", "how many bedrooms?"  | answered from the property's data     |
| "tell me about the second one"              | details of result #2                  |
| "I'm interested", "contact an agent"        | enquiry form (existing enquiry flow)  |
| "how do I search / submit an enquiry?"      | short help answer                     |

Anything it does not understand gets an honest "I'm not sure I understood"
reply with suggestions; it never makes up answers. Questions about leads,
customers, agents' contact details or other internal data are declined, and
there is no code path that reads them.

## Conversation and privacy

The conversation (messages and current filters) lives in memory for the
browser session only. Nothing is stored. Enquiries use the existing
`createEnquiry` service, so the CRM receives the customer, lead, activity and
notification exactly as with the property-page form.

## Deploy

Apply the migration that adds state, exact-bedroom and area filters to
`search_properties`:

```bash
npx supabase db push
```

No secrets or Edge Functions are needed.

## Extending

Add synonyms or new phrasings in `src/lib/chatParser.ts` (each pattern list is
near the top of the file) and cover them in `src/lib/chatParser.test.ts`.
