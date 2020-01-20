# GraphQL Field Resolver Example

## Running

```
yarn

yarn start
```


Visit the url at:

`http://localhost:4000/graphql`

This will give you a graphql playground to send example requests.

## Step One: Partial query, not fetching extra fields

Here is an initial request to get things started.

```graphql
query QueryOne {
  persons {
    id
    firstName
    lastName
    # emailCount
    # noteCount
    # attachmentCount
  }
}
```

Initially things will be using the `/search-partial` which simulates a search api that is still under development and only resolves id,firstName,lastName

If you run the above query (`QueryOne`) the data will appear as expected. And if you monitor the node process stdout you'll see NO logs from the emailCount/noteCount/attachmentCount resolvers.  This is because the client did not request those fields.

## Step Two: Full query, fetching extra fields

```graphql
query QueryTwo {
  persons {
    id
    firstName
    lastName
    emailCount
    noteCount
    attachmentCount
  }
}
```

Run the above query (QueryTwo). Once again the data was fetched in the playground successfully.
Now inspect stdout in the terminal.
You'll now see all the 3 resolvers for each resolver. As well as a NETWORK REQUEST to the legacy person batched endpoint.

```
[NETWORK REQUEST: SEARCH-PARTIAL]
...
...
[email count resolver] id: 8
[note count resolver] id: 8
[attachment count resolver] id: 8
[email count resolver] id: 9
[note count resolver] id: 9
[attachment count resolver] id: 9
[NETWORK REQUEST: LEGACY-PERSON-BATCH]: ids=1,2,3,4,5,6,7,8,9
```

(if you're not seeing the network request, try restarting/refreshing the server. data loader does some caching which is useful in prod, but not here :P )

The fact that the partial search DID NOT return the fields means that we have to go to the field resolvers and hit the legacy endpoints.



## Step Three: Full query, fetching extra fields. With completed search api

Uncomment the persons resolver to hit the `/search-full` endpoint rather than `/search-partial`.

Now the search api returns all the data that we expect.

Rerun `QueryTwo` and inspect the node logs.

You will see ONLY the call to the full search endpoint:

```
[NETWORK REQUEST: SEARCH-FULL]
```

and no resolver logs or legacy endpoints being hit.

# 🎉
