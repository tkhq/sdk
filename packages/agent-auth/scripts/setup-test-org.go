// +build ignore

// Creates a test organization on local Turnkey infra and prints credentials.
// Run from the mono repo: go run ./packages/agent-auth/scripts/setup-test-org.go
// Or: cd ~/turnkey/mono && TK_ENV=local go run ~/turnkey/sdk/packages/agent-auth/scripts/setup-test-org.go

package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/tkhq/mono/src/go/pkg/db"
	"github.com/tkhq/mono/src/go/pkg/db/handle"
	"github.com/tkhq/mono/src/go/pkg/models/fixtures"
)

func main() {
	ctx := context.Background()

	// Connect to local DB
	dbc, err := db.NewPool(ctx, db.PoolOptions{
		Database:   db.DatabaseMain,
		AccessMode: db.AccessModeRW,
	})
	if err != nil {
		log.Fatal("failed to connect to DB:", err)
	}

	h := handle.NewHandle(dbc)

	// Get the fixture org
	org := fixtures.Organization()

	// Generate a P256 API key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		log.Fatal("failed to generate key:", err)
	}

	pubKeyBytes := elliptic.MarshalCompressed(privateKey.PublicKey.Curve, privateKey.PublicKey.X, privateKey.PublicKey.Y)
	privKeyBytes := privateKey.D.Bytes()

	fmt.Printf("TURNKEY_ORG_ID=%s\n", org.ID)
	fmt.Printf("TURNKEY_API_PUBLIC_KEY=%s\n", hex.EncodeToString(pubKeyBytes))
	fmt.Printf("TURNKEY_API_PRIVATE_KEY=%s\n", hex.EncodeToString(privKeyBytes))
	fmt.Printf("TURNKEY_API_BASE_URL=http://localhost:8081\n")

	_ = h
	_ = ctx
	os.Exit(0)
}
