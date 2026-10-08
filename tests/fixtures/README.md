# Synthetic AAC regression fixture

`synthetic-aac-priming.m4a` is a 128 ms, 997 Hz mono sine wave generated for these tests. It contains no recorded audio or user media. Its seven AAC packets use a 48,000 Hz media clock and a 1,024-sample head-priming edit. The media duration is 7,168 ticks; the presented edit duration is 128 movie ticks at 1,000 Hz.

Generation command (documentation only; FFmpeg is **not** required to run tests or builds):

```sh
ffmpeg -v error -f lavfi -i 'sine=frequency=997:sample_rate=48000:duration=0.128' -c:a aac -b:a 64k -map_metadata -1 -movflags +faststart synthetic-aac-priming.m4a
```

The mandatory Node tests use the pinned MP4Box 2.4.1 bytes restored into a temporary directory from the committed standalone HTML. They work before a first build, without the ignored vendor cache or network access. No decoder/model runs in this suite. Packet, raw timing, edit-list and movie/media-duration round-trips are checked using the actual production mux helpers. Native WebCodecs/browser export and decoded-PCM comparison remain separate validation layers.

SHA-256: `cbf22b5f6775fb983f2c804da54a8c07eba1a40672a2debf3de4ae2db8b74f27`.
