// Adaptive retry mechanism for handling Claude usage limits

class AdaptiveRetry {
  constructor() {
    this.baseDelay = 30000; // 30 seconds base
    this.maxDelay = 3600000; // 1 hour max
    this.backoffMultiplier = 2;
    this.consecutiveFailures = 0;
  }

  getNextDelay() {
    // Calculate exponential backoff: 30s, 1m, 2m, 4m, 8m, 16m, 32m, 60m (max)
    const delay = Math.min(
      this.baseDelay * Math.pow(this.backoffMultiplier, this.consecutiveFailures),
      this.maxDelay
    );
    return delay;
  }

  recordSuccess() {
    // Reset on successful iteration
    this.consecutiveFailures = 0;
  }

  recordFailure() {
    this.consecutiveFailures++;
  }

  async waitWithRetry(spawner, maxRetries = 5) {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const result = await spawner();

        // If successful, reset failure count
        if (result) {
          this.recordSuccess();
          return result;
        }

        // If spawn returned false (likely usage limit)
        attempts++;
        this.recordFailure();

        const delay = this.getNextDelay();
        // console.log(`⏳ Usage limit likely hit. Waiting ${delay/1000}s before retry (attempt ${attempts}/${maxRetries})...`);

        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error) {
        console.error('❌ Error in retry loop:', error);
        attempts++;

        if (attempts >= maxRetries) {
          throw error;
        }

        const delay = this.getNextDelay();
        // console.log(`⏳ Error occurred. Waiting ${delay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts`);
  }
}

module.exports = AdaptiveRetry;
