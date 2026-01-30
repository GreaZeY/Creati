package commands

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

// Config represents the creati.yaml configuration
type Config struct {
	Mode         string `yaml:"mode"`
	FrontendPath string `yaml:"frontend_path"`
	BackendPath  string `yaml:"backend_path"`
	DevConfig    struct {
		FrontendCommand string `yaml:"frontend_command"`
		BackendCommand  string `yaml:"backend_command"`
		FrontendPort    int    `yaml:"frontend_port"`
		BackendPort     int    `yaml:"backend_port"`
	} `yaml:"dev"`
	ProdConfig struct {
		FrontendCommand string `yaml:"frontend_command"`
		BackendCommand  string `yaml:"backend_command"`
		FrontendDist    string `yaml:"frontend_dist"`
		BackendBin      string `yaml:"backend_bin"`
	} `yaml:"prod"`
}

// IsDev returns true if running in development mode
func (c *Config) IsDev() bool {
	return c.Mode == "dev"
}

var config *Config

// rootCmd represents the base command
var rootCmd = &cobra.Command{
	Use:   "creati",
	Short: "Creati development tool",
	Long:  `Repo-local CLI for managing Creati development workflow`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ensureProjectRoot()
		loadConfig()
	},
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(startCmd)
	rootCmd.AddCommand(buildCmd)
	rootCmd.AddCommand(logsCmd)
	rootCmd.AddCommand(devCmd)
	rootCmd.AddCommand(doctorCmd)
}

// ensureProjectRoot validates we're in the project root
func ensureProjectRoot() {
	sentinels := []string{
		"frontend/vite.config.ts",
		"backend/go.mod",
		"creati.yaml",
	}

	for _, file := range sentinels {
		if _, err := os.Stat(file); err != nil {
			fmt.Printf("❌ creati must be run from project root (missing: %s)\n", file)
			os.Exit(1)
		}
	}
}

// loadConfig reads creati.yaml
func loadConfig() {
	data, err := os.ReadFile("creati.yaml")
	if err != nil {
		fmt.Println("❌ Failed to read creati.yaml:", err)
		os.Exit(1)
	}

	config = &Config{}
	if err := yaml.Unmarshal(data, config); err != nil {
		fmt.Println("❌ Failed to parse creati.yaml:", err)
		os.Exit(1)
	}
}

// GetConfig returns the loaded configuration
func GetConfig() *Config {
	return config
}
