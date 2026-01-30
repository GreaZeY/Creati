package main

import (
	"os"

	"creati.in/creati/cli/cmd/creati/commands"
)

func main() {
	if err := commands.Execute(); err != nil {
		os.Exit(1)
	}
}
