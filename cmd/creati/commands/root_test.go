package commands

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfigFromProjectDirectories(t *testing.T) {
	for _, subdir := range []string{".", "backend", filepath.Join("backend", "internal", "api"), "frontend"} {
		t.Run(subdir, func(t *testing.T) {
			previousConfig := config
			t.Cleanup(func() { config = previousConfig })
			root := filepath.Join(t.TempDir(), "project with spaces")
			cwd := filepath.Join(root, subdir)
			if err := os.MkdirAll(cwd, 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(root, "creati.yaml"), []byte("mode: dev\nbackend_path: backend\nfrontend_path: frontend\n"), 0644); err != nil {
				t.Fatal(err)
			}
			t.Chdir(cwd)
			if err := loadConfig(); err != nil {
				t.Fatal(err)
			}
			if got, err := os.Getwd(); err != nil || got != root {
				t.Fatalf("working directory = %q, error = %v; want %q", got, err, root)
			}
			if !config.IsDev() || config.BackendPath != "backend" || config.FrontendPath != "frontend" {
				t.Fatalf("unexpected config: %+v", config)
			}
		})
	}
}

func TestLoadConfigUsesNearestProject(t *testing.T) {
	previousConfig := config
	t.Cleanup(func() { config = previousConfig })
	outer := t.TempDir()
	inner := filepath.Join(outer, "nested-project")
	cwd := filepath.Join(inner, "backend")
	if err := os.MkdirAll(cwd, 0755); err != nil {
		t.Fatal(err)
	}
	for path, mode := range map[string]string{outer: "dev", inner: "prod"} {
		if err := os.WriteFile(filepath.Join(path, "creati.yaml"), []byte("mode: "+mode+"\n"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	t.Chdir(cwd)
	if err := loadConfig(); err != nil {
		t.Fatal(err)
	}
	if got, err := os.Getwd(); err != nil || got != inner || config.Mode != "prod" {
		t.Fatalf("nearest project not selected: directory = %q, error = %v, config = %+v", got, err, config)
	}
}

func TestLoadConfigErrorsPreserveWorkingDirectoryAndConfig(t *testing.T) {
	for _, malformed := range []bool{false, true} {
		name := "missing"
		if malformed {
			name = "invalid"
		}
		t.Run(name, func(t *testing.T) {
			previousConfig := config
			t.Cleanup(func() { config = previousConfig })
			root := t.TempDir()
			cwd := filepath.Join(root, "backend")
			if err := os.MkdirAll(cwd, 0755); err != nil {
				t.Fatal(err)
			}
			if malformed {
				if err := os.WriteFile(filepath.Join(root, "creati.yaml"), []byte("mode: [\n"), 0644); err != nil {
					t.Fatal(err)
				}
			}
			t.Chdir(cwd)
			err := loadConfig()
			want := "not found"
			if malformed {
				want = "parse "
			}
			if err == nil || !strings.Contains(err.Error(), want) {
				t.Fatalf("expected %q configuration error, got %v", want, err)
			}
			if got, err := os.Getwd(); err != nil || got != cwd || config != previousConfig {
				t.Fatalf("failed load changed state: directory = %q, error = %v", got, err)
			}
		})
	}
}
