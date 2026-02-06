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
	Short: "Creati CLI",
	Long:  `CLI for managing Creati workflow`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		loadConfig()
	},
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

// Commands self-register via their own init() functions

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
