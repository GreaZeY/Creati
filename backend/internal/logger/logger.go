package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
)

var (
	loggers = make(map[string]*logrus.Logger)
	mu      sync.Mutex
)

// ensureLogDir ensures the logs directory exists
func ensureLogDir() string {
	// cwd, _ := os.Getwd()
	// Navigate one level up if in cmd/*, or just use backend root
	// Simplified: Assuming we run from backend root or cmd/worker
	// Let's rely on relative path "logs" for now, or absolute path if possible.
	// Better: Use a fixed relative path "logs" and let OS handle it relative to CWD.
	// The user requested "backend/logs", assuming CWD is backend/
	logDir := "logs"
	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		os.Mkdir(logDir, 0755)
	}
	return logDir
}

// CustomFormatter formats logs as: time="..." level=[LEVEL] msg="..." field=value ...
type CustomFormatter struct{}

func (f *CustomFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	// Format time in local time zone ISO8601
	timeStr := entry.Time.Local().Format("2006-01-02T15:04:05-07:00")

	// Uppercase level in brackets
	levelStr := fmt.Sprintf("[%s]", strings.ToUpper(entry.Level.String()))

	// Build the base log message
	var b strings.Builder
	fmt.Fprintf(&b, "time=\"%s\" level=%s msg=\"%s\"", timeStr, levelStr, entry.Message)

	// Append all fields from entry.Data
	for k, v := range entry.Data {
		// Convert error to string if needed, or just standard formatting
		fmt.Fprintf(&b, " %s=\"%v\"", k, v)
	}

	b.WriteByte('\n')
	return []byte(b.String()), nil
}

// Get returns a logger instance for the specific file
// This allows using the full power of logrus (WithFields, etc.)
func Get(filename string) *logrus.Logger {
	mu.Lock()
	defer mu.Unlock()

	if logger, exists := loggers[filename]; exists {
		return logger
	}

	logDir := ensureLogDir()
	logPath := filepath.Join(logDir, fmt.Sprintf("%s.log", filename))

	logger := logrus.New()

	// Create file - robustly handle errors
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		logger.SetOutput(file)
	} else {
		// Fallback to stderr if file fails, do not crash
		logger.SetOutput(os.Stderr)
		// We can try to log the error to stderr too
		fmt.Fprintf(os.Stderr, "Failed to open log file %s: %v\n", logPath, err)
	}

	logger.SetFormatter(&CustomFormatter{})

	loggers[filename] = logger
	return logger
}

// Log writes a log entry to the specified file.
// Deprecated: Use Get(filename).WithFields(...).Info(...) for structured logging.
func Log(level string, message string, err error, filename string) {
	l := Get(filename)

	var entry *logrus.Entry
	if err != nil {
		entry = l.WithField("error", err)
	} else {
		entry = logrus.NewEntry(l)
	}

	switch level {
	case "debug":
		entry.Debug(message)
	case "info":
		entry.Info(message)
	case "warn":
		entry.Warn(message)
	case "error":
		entry.Error(message)
	default:
		entry.Info(message)
	}
}
