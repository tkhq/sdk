## Rebalance

A demo application utilizing the Turnkey API to sweep funds from a set of addresses

### Setup

* Create a user with an API key called "executor"
* Create a user with an API key called "manager"
* Create a user with an API key called "admin"
* Create a private key and label it "bank"
* Create 5 private keys and label them "source"
* Create a private key and label it "sink"
* Create a policy that "executor" can spend funds from a private key labeled "source"
* Create a policy that "manager" + "admin" can spend funds from a private key labeled "sink"

### Fund

* Loop over a set of addresses labeled "source"
* Send this address a constant value of ETH from "bank"

### Execute

* Loop over a "source" addresses
* When an address has a balance that exceeds a constant value, sweep to "sink"

### Manager

* Initiate a transfer of funds from "sink" to "bank" unless there's an existing pending transfer
* Approve that transfer in the UI using the authenticator for an "admin" user

### Thoughts
i'd like to demonstrate how turnkey could be set up to sweep funds from a set of addresses (calling these "source") to a more secure address (calling this "sink"). so first pass at a demo i was hoping to create a structure where:
execute a command "initialize" to create a a set of addresses, api keys, and policies in a new Turnkey account (this is outlined in a bit more detail in the README)
execute a command "fund" to send funds to the "source" addresses from an address called "bank"
execute a command "sweep" to send any funds that exceed some threshold from the "source" to the "sinks" using a single API key
execute a command "recycle" to, using a multi-party approval, sweep everything from "sink" back to "bank"


```
pnpm setup (create users, private keys, policies)
pnpm fund (bank -> source, requires "admin")
pnpm sweep (source -> sink)
pnpm manager (sink -> bank, requires "manager")

// policies (private_keys + addresses)
addresses:
"source" keys can only send to "sink" addresses
"sink" keys can only send to "source" addresses or "bank" addresses

users:
"admin" can send w/ "bank" keys
"mananger" can send w/ "sink" keys
"executor" can send w/ "source" keys
```