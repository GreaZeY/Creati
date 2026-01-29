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

// CustomFormatter formats logs as: time="..." level=[LEVEL] msg="..." error="..."
type CustomFormatter struct{}

func (f *CustomFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	// Format time in local time zone ISO8601
	timeStr := entry.Time.Local().Format("2006-01-02T15:04:05-07:00")

	// Uppercase level in brackets
	levelStr := fmt.Sprintf("[%s]", strings.ToUpper(entry.Level.String()))

	// Build the base log message
	logMsg := fmt.Sprintf("time=\"%s\" level=%s msg=\"%s\"", timeStr, levelStr, entry.Message)

	// Append error if present
	if errVal, ok := entry.Data["error"]; ok {
		logMsg = fmt.Sprintf("%s error=\"%v\"", logMsg, errVal)
	}

	return []byte(logMsg + "\n"), nil
}

// getLogger returns a logger instance for the specific file
func getLogger(filename string) *logrus.Logger {
	mu.Lock()
	defer mu.Unlock()

	if logger, exists := loggers[filename]; exists {
		return logger
	}

	logDir := ensureLogDir()
	logPath := filepath.Join(logDir, fmt.Sprintf("%s.log", filename))

	logger := logrus.New()

	// Create file
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		logger.SetOutput(file)
	} else {
		logger.Info("Failed to log to file, using default stderr")
	}

	logger.SetFormatter(&CustomFormatter{})

	loggers[filename] = logger
	return logger
}

// Log writes a log entry to the specified file.
// level: "info", "debug", "warn", "error"
// err: optional error, used only if level is "error"
func Log(level string, message string, err error, filename string) {
	logger := getLogger(filename)

	switch level {
	case "debug":
		logger.Debug(message)
	case "info":
		logger.Info(message)
	case "warn":
		logger.Warn(message)
	case "error":
		if err != nil {
			logger.WithField("error", err).Error(message)
		} else {
			logger.Error(message)
		}
	default:
		logger.Info(message)
	}
}
