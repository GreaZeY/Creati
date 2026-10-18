package commands

import (
	"fmt"
	"os"
	"path/filepath"

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
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		return loadConfig()
	},
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

// Commands self-register via their own init() functions

// loadConfig finds the nearest project and anchors all relative paths to it.
func loadConfig() error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("get working directory: %w", err)
	}

	for dir := cwd; ; dir = filepath.Dir(dir) {
		path := filepath.Join(dir, "creati.yaml")
		data, err := os.ReadFile(path)
		if err == nil {
			cfg := &Config{}
			if err := yaml.Unmarshal(data, cfg); err != nil {
				return fmt.Errorf("parse %s: %w", path, err)
			}
			if err := os.Chdir(dir); err != nil {
				return fmt.Errorf("enter project root %s: %w", dir, err)
			}
			config = cfg
			return nil
		}
		if !os.IsNotExist(err) {
			return fmt.Errorf("read %s: %w", path, err)
		}
		if filepath.Dir(dir) == dir {
			return fmt.Errorf("creati.yaml not found in %s or its parent directories", cwd)
		}
	}
}

// GetConfig returns the loaded configuration
func GetConfig() *Config {
	return config
}
