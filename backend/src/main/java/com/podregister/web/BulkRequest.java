package com.podregister.web;

import java.util.List;

public record BulkRequest(List<EntryRequest> entries) {}
