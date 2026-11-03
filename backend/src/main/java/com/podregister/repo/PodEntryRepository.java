package com.podregister.repo;

import com.podregister.model.PodEntry;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PodEntryRepository extends JpaRepository<PodEntry, Long> {

    @Query("select e from PodEntry e where e.entryDate between :from and :to order by e.entryDate, e.podNumber")
    List<PodEntry> findBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select e from PodEntry e order by e.entryDate, e.podNumber")
    List<PodEntry> findAllOrdered();

    @Query("select e.podNumber from PodEntry e where e.podNumber in :numbers")
    List<String> findExisting(@Param("numbers") Collection<String> numbers);

    boolean existsByPodNumberAndIdNot(String podNumber, Long id);

    long countByCustomerId(Long customerId);
}
