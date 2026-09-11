<?php
declare(strict_types=1);

// Bounded DNS queries avoid PHP's blocking dns_get_record resolver timeout.
// Only server-configured resolvers are contacted; callers cannot choose one.
function dns_addresses(string $host, float $deadline, int $depth = 0): array
{
    if ($depth > 4 || microtime(true) >= $deadline) throw new RuntimeException('DNS timeout');
    $resolvers = config()['dns_servers'] ?? [];
    if (!$resolvers && is_readable('/etc/resolv.conf')) {
        preg_match_all('/^nameserver\s+(\S+)/m', file_get_contents('/etc/resolv.conf'), $matches);
        $resolvers = $matches[1];
    }
    if (!$resolvers) $resolvers = ['1.1.1.1', '8.8.8.8'];
    $addresses = []; $aliases = [];
    foreach ([1, 28] as $type) {
        $answered = false;
        foreach (array_slice($resolvers, 0, 2) as $resolver) {
            if (!filter_var($resolver, FILTER_VALIDATE_IP)) continue;
            $remaining = min(1.5, $deadline - microtime(true));
            if ($remaining <= 0) throw new RuntimeException('DNS timeout');
            $address = strpos($resolver, ':') !== false ? '[' . $resolver . ']' : $resolver;
            $socket = @stream_socket_client('udp://' . $address . ':53', $errno, $error, $remaining);
            if (!$socket) continue;
            try {
                stream_set_timeout($socket, (int) $remaining, (int) (($remaining - (int) $remaining) * 1000000));
                $id = random_int(0, 65535);
                $question = '';
                foreach (explode('.', rtrim($host, '.')) as $label) {
                    if ($label === '' || strlen($label) > 63) throw new RuntimeException('Invalid DNS name');
                    $question .= chr(strlen($label)) . $label;
                }
                $packet = pack('nnnnnn', $id, 256, 1, 0, 0, 0) . $question . "\0" . pack('nn', $type, 1);
                fwrite($socket, $packet);
                $reply = fread($socket, 4096);
                if (strlen($reply) < 12) continue;
                $header = unpack('nid/nflags/nqd/nan/nns/nar', substr($reply, 0, 12));
                if ($header['id'] !== $id || !($header['flags'] & 32768) || ($header['flags'] & 512) || ($header['flags'] & 15) || $header['qd'] !== 1) continue;
                $offset = 12;
                $name = dns_name($reply, $offset);
                if (strcasecmp(rtrim($name, '.'), rtrim($host, '.')) !== 0 || substr($reply, $offset, 4) !== pack('nn', $type, 1)) continue;
                $offset += 4;
                for ($i = 0; $i < $header['an']; $i++) {
                    dns_name($reply, $offset);
                    if ($offset + 10 > strlen($reply)) throw new RuntimeException('Invalid DNS response');
                    $record = unpack('ntype/nclass/Nttl/nlength', substr($reply, $offset, 10));
                    $offset += 10;
                    $length = $record['length'];
                    if ($offset + $length > strlen($reply)) throw new RuntimeException('Invalid DNS response');
                    if ($record['class'] === 1 && (($record['type'] === 1 && $length === 4) || ($record['type'] === 28 && $length === 16))) {
                        $addresses[] = inet_ntop(substr($reply, $offset, $length));
                    } elseif ($record['type'] === 5 && $record['class'] === 1) {
                        $cursor = $offset;
                        $aliases[] = dns_name($reply, $cursor);
                    }
                    $offset += $length;
                }
                $answered = true;
                break;
            } finally { fclose($socket); }
        }
        if (!$answered) throw new RuntimeException('DNS unavailable');
    }
    if (!$addresses) {
        foreach (array_unique($aliases) as $alias) $addresses = array_merge($addresses, dns_addresses($alias, $deadline, $depth + 1));
    }
    if (!$addresses) throw new RuntimeException('DNS has no addresses');
    return array_values(array_unique($addresses));
}

function dns_name(string $packet, int &$offset): string
{
    $labels = []; $cursor = $offset; $jumped = false;
    for ($steps = 0; $steps < 128; $steps++) {
        if ($cursor >= strlen($packet)) break;
        $length = ord($packet[$cursor++]);
        if ($length === 0) { if (!$jumped) $offset = $cursor; return implode('.', $labels); }
        if (($length & 192) === 192) {
            if ($cursor >= strlen($packet)) break;
            $pointer = (($length & 63) << 8) | ord($packet[$cursor++]);
            if (!$jumped) $offset = $cursor;
            $cursor = $pointer; $jumped = true;
        } else {
            if ($length > 63 || $cursor + $length > strlen($packet)) break;
            $labels[] = substr($packet, $cursor, $length); $cursor += $length;
        }
    }
    throw new RuntimeException('Invalid DNS name');
}
