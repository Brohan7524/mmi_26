# Dummy Redis implementation - no actual Redis connection
class DummyRedis:
    def __init__(self):
        self.data = {}
    
    def zadd(self, key, mapping):
        """Dummy zadd - just stores in memory"""
        if key not in self.data:
            self.data[key] = {}
        self.data[key].update(mapping)
        print(f"[DUMMY] Added to queue {key}: {len(mapping)} items")
        return len(mapping)
    
    def zrange(self, key, start, end, withscores=False):
        """Dummy zrange"""
        if key not in self.data:
            return []
        items = list(self.data[key].items())
        if withscores:
            return items[start:end+1]
        return [item[0] for item in items[start:end+1]]
    
    def zrem(self, key, *values):
        """Dummy zrem"""
        if key not in self.data:
            return 0
        count = 0
        for value in values:
            if value in self.data[key]:
                del self.data[key][value]
                count += 1
        return count

r = DummyRedis()